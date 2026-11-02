import {
    Generate,
    chat,
    chat_metadata,
    characters,
    create_save,
    createOrEditCharacter,
    deleteCharacter,
    deleteCharacterChatByName,
    deleteMessage,
    doNewChat,
    getCharacters,
    getCurrentChatId,
    getRequestHeaders,
    getThumbnailUrl,
    isGenerating,
    main_api,
    name1,
    name2,
    online_status,
    openCharacterChat,
    saveChat,
    saveMetadata,
    saveSettingsDebounced,
    selectCharacterById,
    select_selected_character,
    sendTextareaMessage,
    setCharacterId,
    stopGeneration,
    swipe_left,
    swipe_right,
    this_chid,
} from '../../script.js';
import { eventSource, event_types } from '../events.js';
import { accountStorage } from '../util/AccountStorage.js';
import { power_user } from '../power-user.js';
import { currentUser } from '../user.js';
import { getUserAvatars, initPersona, setUserAvatar, user_avatar } from '../personas.js';
import { SECRET_KEYS, secret_state, writeSecret } from '../secrets.js';
import { getChatCompletionModel, getChatCompletionPreset, getPresetApplicationPromise, oai_settings, settingsToUpdate } from '../openai.js';
import { getTextGenModel, SERVER_INPUTS, textgenerationwebui_settings } from '../textgen-settings.js';
import { getCharaFilename } from '../utils.js';
import { metadata_keys as authorNoteKeys, setFloatingPrompt } from '../authors-note.js';
import { getPresetManager } from '../preset-manager.js';
import { charSetAuxWorlds, METADATA_KEY as WORLD_INFO_METADATA_KEY, onWorldInfoChange, selected_world_info, world_info } from '../world-info.js';

export { stopGeneration };

export const MODE_STORAGE_KEY = 'EasierTavern_InterfaceMode';
const SIDEBAR_STORAGE_KEY = 'EasierTavern_SidebarCollapsed';
const FAVORITE_MODELS_STORAGE_KEY = 'EasierTavern_FavoriteModels';
const AUTO_CONNECT_MIGRATION_KEY = 'EasierTavern_AutoConnectDefaultV1';
const AFFINITY_METADATA_KEY = 'easierTavernAffinity';
const AFFINITY_TURN_KEY = 'easierTavernTurnId';
const IGNORED_AFFINITY_GENERATION_TYPES = new Set(['first_message', 'swipe', 'continue', 'append', 'appendfinal', 'regenerate', 'impersonate', 'quiet']);

export const AFFINITY_LEVELS = [
    { threshold: 0, label: 'Stranger' },
    { threshold: 40, label: 'Acquaintance' },
    { threshold: 120, label: 'Friend' },
    { threshold: 280, label: 'Close friend' },
    { threshold: 520, label: 'Partner' },
    { threshold: 850, label: 'In love' },
    { threshold: 1250, label: 'Promised' },
    { threshold: 1750, label: 'Engaged' },
    { threshold: 2400, label: 'Married' },
    { threshold: 3200, label: 'Until death do us part' },
];

const listeners = new Set();
const watchedEvents = [
    event_types.APP_READY,
    event_types.CHAT_CHANGED,
    event_types.CHAT_CREATED,
    event_types.CHAT_DELETED,
    event_types.CHAT_RENAMED,
    event_types.MESSAGE_SENT,
    event_types.MESSAGE_RECEIVED,
    event_types.MESSAGE_EDITED,
    event_types.MESSAGE_DELETED,
    event_types.MESSAGE_UPDATED,
    event_types.MESSAGE_SWIPED,
    event_types.STREAM_TOKEN_RECEIVED,
    event_types.GENERATION_STARTED,
    event_types.GENERATION_STOPPED,
    event_types.GENERATION_ENDED,
    event_types.ONLINE_STATUS_CHANGED,
    event_types.CHARACTER_EDITED,
    event_types.CHARACTER_DELETED,
    event_types.PERSONA_CHANGED,
    event_types.PERSONA_CREATED,
    event_types.PERSONA_UPDATED,
    event_types.PERSONA_RENAMED,
    event_types.PERSONA_DELETED,
    event_types.WORLDINFO_UPDATED,
    event_types.SETTINGS_UPDATED,
];

let recentChats = [];
let lorebooks = [];
let appReady = false;
let connectionPending = false;
let connectionError = '';
let connectionPromise = null;

function emit() {
    const snapshot = getSnapshot();
    for (const listener of listeners) {
        listener(snapshot);
    }
}

for (const event of watchedEvents) {
    eventSource.on(event, async (...args) => {
        if (event === event_types.APP_READY) {
            appReady = true;
            initializeEasierTavern();
            refreshCollections();
        }
        if (!appReady) return;
        if (event === event_types.MESSAGE_RECEIVED) {
            try {
                await awardAffinityForMessage(args[0], args[1]);
            } catch (error) {
                console.warn('[Simple UI] Affinity could not be updated', error);
            }
        }
        emit();
    });
}

export function getAffinityState(score = 0) {
    const normalized = Math.max(0, Number(score) || 0);
    let index = 0;
    for (let i = 0; i < AFFINITY_LEVELS.length; i++) {
        if (normalized >= AFFINITY_LEVELS[i].threshold) index = i;
        else break;
    }
    const level = AFFINITY_LEVELS[index];
    const next = AFFINITY_LEVELS[index + 1] || null;
    const progress = next
        ? Math.max(0, Math.min(100, ((normalized - level.threshold) / (next.threshold - level.threshold)) * 100))
        : 100;
    return { score: normalized, level: level.label, nextLevel: next?.label || null, progress };
}

export function isMeaningfulAffinityMessage(message) {
    if (!message?.is_user || message.is_system) return false;
    const text = String(message.mes || '').trim();
    return text.length >= 5 && !text.startsWith('/');
}

export function buildAffinityTurnAward(stored, userMessage, generationType, random = Math.random, createId = () => crypto.randomUUID()) {
    if (IGNORED_AFFINITY_GENERATION_TYPES.has(String(generationType || '').toLowerCase())) return null;
    if (!isMeaningfulAffinityMessage(userMessage)) return null;

    userMessage.extra ??= {};
    userMessage.extra[AFFINITY_TURN_KEY] ||= createId();
    const affinity = stored && typeof stored === 'object' ? clone(stored) : {};
    const awardedTurns = Array.isArray(affinity.awardedTurns) ? affinity.awardedTurns : [];
    if (awardedTurns.includes(userMessage.extra[AFFINITY_TURN_KEY])) return null;

    const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
    const points = Math.floor(roll * 5) + 1;
    return {
        points,
        turnId: userMessage.extra[AFFINITY_TURN_KEY],
        affinity: {
            version: 1,
            score: Math.max(0, Number(affinity.score) || 0) + points,
            awardedTurns: [...awardedTurns, userMessage.extra[AFFINITY_TURN_KEY]],
        },
    };
}

export async function awardAffinityForMessage(messageId, generationType, random = Math.random) {
    const responseId = Number(messageId);
    const response = chat[responseId];
    if (!Number.isInteger(responseId) || !response || response.is_user || response.is_system || !response.gen_finished) return false;

    let userMessage = null;
    for (let index = responseId - 1; index >= 0; index--) {
        if (chat[index]?.is_user && !chat[index]?.is_system) {
            userMessage = chat[index];
            break;
        }
    }
    const award = buildAffinityTurnAward(chat_metadata[AFFINITY_METADATA_KEY], userMessage, generationType, random);
    if (!award) return false;
    chat_metadata[AFFINITY_METADATA_KEY] = award.affinity;
    await saveChat();
    return true;
}

function applyMode(mode) {
    const minimal = mode !== 'advanced';
    document.body.classList.toggle('simple-ui-active', minimal);
    document.body.classList.toggle('simple-ui-advanced', !minimal);
    document.getElementById('simple-ui-root')?.setAttribute('aria-hidden', String(!minimal));
}

function initializeEasierTavern() {
    const params = new URLSearchParams(location.search);
    const forcedMode = params.get('ui');
    if (forcedMode === 'advanced' || forcedMode === 'minimal') {
        accountStorage.setItem(MODE_STORAGE_KEY, forcedMode);
        params.delete('ui');
        history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    }

    if (accountStorage.getItem(AUTO_CONNECT_MIGRATION_KEY) !== '1') {
        power_user.auto_connect = true;
        $('#auto-connect-checkbox').prop('checked', true);
        accountStorage.setItem(AUTO_CONNECT_MIGRATION_KEY, '1');
        saveSettingsDebounced();
    }

    applyMode(getMode());
    if (power_user.auto_connect && online_status === 'no_connection') {
        queueMicrotask(() => reconnectLastServer().catch(error => {
            connectionError = error?.message || 'Automatic connection failed';
            emit();
        }));
    }
}

function clone(value) {
    try {
        return structuredClone(value);
    } catch {
        return JSON.parse(JSON.stringify(value));
    }
}

function getFavoriteModels() {
    try {
        const value = JSON.parse(accountStorage.getItem(FAVORITE_MODELS_STORAGE_KEY) || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
        return {};
    }
}

function getMode() {
    return accountStorage.getItem(MODE_STORAGE_KEY) === 'advanced' ? 'advanced' : 'minimal';
}

function textValue(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.filter(item => typeof item === 'string' && item.trim()).join('\n');
    return value == null ? '' : String(value);
}

function stringList(value) {
    return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()) : [];
}

function characterView(character, id) {
    const fileName = getCharaFilename(null, { manualAvatarKey: character.avatar });
    const extraLorebooks = world_info.charLore?.find(entry => entry.name === fileName)?.extraBooks || [];
    return {
        id,
        name: character.name || character.data?.name || 'Character',
        avatar: character.avatar,
        avatarUrl: character.avatar ? getThumbnailUrl('avatar', character.avatar) : '/img/ai4.png',
        description: textValue(character.description || character.data?.description),
        personality: textValue(character.personality || character.data?.personality),
        scenario: textValue(character.scenario || character.data?.scenario),
        firstMessage: textValue(character.first_mes || character.data?.first_mes),
        exampleMessages: textValue(character.mes_example || character.data?.mes_example),
        tags: stringList(character.data?.tags),
        alternateGreetings: stringList(character.data?.alternate_greetings),
        systemPrompt: textValue(character.data?.system_prompt),
        postHistoryInstructions: textValue(character.data?.post_history_instructions),
        creator: textValue(character.data?.creator),
        characterVersion: textValue(character.data?.character_version),
        creatorNotes: textValue(character.data?.creator_notes || character.creatorcomment),
        depthPrompt: textValue(character.data?.extensions?.depth_prompt?.prompt),
        depthPromptDepth: character.data?.extensions?.depth_prompt?.depth ?? 4,
        depthPromptRole: character.data?.extensions?.depth_prompt?.role || 'system',
        primaryLorebook: character.data?.extensions?.world || '',
        extraLorebooks,
        chat: character.chat || '',
    };
}

function personaViews() {
    return Object.entries(power_user.personas || {}).map(([avatar, name]) => ({
        avatar,
        name,
        active: avatar === user_avatar,
        avatarUrl: `/User Avatars/${encodeURIComponent(avatar)}`,
        ...(power_user.persona_descriptions?.[avatar] || {}),
    }));
}

export function getSnapshot() {
    const selectedCharacter = Number.isInteger(Number(this_chid)) ? characters[Number(this_chid)] : null;
    const selectedGlobalLorebooks = clone(selected_world_info || []);
    const globalLorebookNames = selectedGlobalLorebooks.map(id => lorebooks.find(book => book.file_id === id || book.name === id)?.name || id);
    const connectionSource = main_api === 'openai'
        ? oai_settings?.chat_completion_source || ''
        : main_api === 'textgenerationwebui' ? textgenerationwebui_settings?.type || '' : '';
    return {
        ready: appReady,
        mode: getMode(),
        sidebarCollapsed: accountStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true',
        autoConnect: Boolean(power_user.auto_connect),
        user: currentUser ? clone(currentUser) : { name: name1 || 'User', handle: 'default-user' },
        characters: characters.map(characterView),
        selectedCharacterId: selectedCharacter ? Number(this_chid) : null,
        selectedCharacter: selectedCharacter ? characterView(selectedCharacter, Number(this_chid)) : null,
        currentChatId: getCurrentChatId(),
        messages: clone(chat),
        chatMetadata: clone(chat_metadata || {}),
        affinity: getAffinityState(chat_metadata?.[AFFINITY_METADATA_KEY]?.score),
        chatSettings: {
            lorebook: chat_metadata?.[WORLD_INFO_METADATA_KEY] || '',
            authorNote: textValue(chat_metadata?.[authorNoteKeys.prompt]),
            authorNoteInterval: Number(chat_metadata?.[authorNoteKeys.interval] ?? 1),
            authorNotePosition: Number(chat_metadata?.[authorNoteKeys.position] ?? 1),
            authorNoteDepth: Number(chat_metadata?.[authorNoteKeys.depth] ?? 4),
            authorNoteRole: Number(chat_metadata?.[authorNoteKeys.role] ?? 0),
            scenario: textValue(chat_metadata?.scenario),
            exampleMessages: textValue(chat_metadata?.mes_example),
            systemPrompt: textValue(chat_metadata?.system_prompt),
        },
        recentChats: clone(recentChats),
        personas: personaViews(),
        lorebooks: clone(lorebooks),
        globalLorebooks: selectedGlobalLorebooks,
        globalLorebookSummary: { count: globalLorebookNames.length, names: globalLorebookNames },
        favoriteModels: clone(getFavoriteModels()),
        connection: {
            family: main_api || 'kobold',
            source: connectionSource,
            status: online_status,
            connected: online_status !== 'no_connection' && online_status !== 'no_connection_error',
            connecting: connectionPending,
            error: connectionError,
            model: main_api === 'openai' ? getChatCompletionModel() || '' : main_api === 'textgenerationwebui' ? getTextGenModel() || '' : '',
            apiKeySaved: hasSecret(secretByProvider[connectionSource] || secretByFamily[main_api]),
            preset: oai_settings?.preset_settings_openai || '',
            models: getActiveModelOptions(),
        },
        aiFeatures: {
            chatCompletion: main_api === 'openai',
            presets: optionViews('#settings_preset_openai'),
            activePresetId: String(document.querySelector('#settings_preset_openai')?.value || ''),
        },
        generating: isGenerating(),
        names: { user: name1, character: name2 },
    };
}

export function subscribe(listener) {
    listeners.add(listener);
    if (appReady) listener(getSnapshot());
    return () => listeners.delete(listener);
}

export async function refreshCollections() {
    if (!appReady) return;
    try {
        const [chatResponse, loreResponse] = await Promise.all([
            fetch('/api/chats/recent', {
                method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ max: 100, metadata: true }),
            }),
            fetch('/api/worldinfo/list', {
                method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({}),
            }),
        ]);
        recentChats = chatResponse.ok ? (await chatResponse.json()).filter(item => item.avatar && !item.group) : [];
        lorebooks = loreResponse.ok ? await loreResponse.json() : [];
    } catch (error) {
        console.warn('[Simple UI] Could not refresh collections', error);
    }
    emit();
}

export function setMode(mode) {
    const normalized = mode === 'advanced' ? 'advanced' : 'minimal';
    accountStorage.setItem(MODE_STORAGE_KEY, normalized);
    applyMode(normalized);
    emit();
}

export function setSidebarCollapsed(collapsed) {
    accountStorage.setItem(SIDEBAR_STORAGE_KEY, String(Boolean(collapsed)));
    emit();
}

export function setFavoriteModels(provider, models) {
    const key = String(provider || '').trim();
    if (!key) throw new Error('Choose a provider first.');
    const favorites = getFavoriteModels();
    favorites[key] = [...new Set((Array.isArray(models) ? models : []).map(String).filter(Boolean))];
    accountStorage.setItem(FAVORITE_MODELS_STORAGE_KEY, JSON.stringify(favorites));
    emit();
}

export function setAutoConnect(enabled, { reconnect = true } = {}) {
    power_user.auto_connect = Boolean(enabled);
    $('#auto-connect-checkbox').prop('checked', power_user.auto_connect);
    saveSettingsDebounced();
    if (reconnect && power_user.auto_connect && online_status === 'no_connection') {
        reconnectLastServer().catch(error => {
            connectionError = error?.message || 'Automatic connection failed';
            emit();
        });
    }
    emit();
}

export async function openChat(chatInfo) {
    const characterId = characters.findIndex(character => character.avatar === chatInfo.avatar);
    if (characterId < 0) throw new Error('Character not found');
    await selectCharacterById(characterId, { switchMenu: false });
    await openCharacterChat(String(chatInfo.file_name || chatInfo.file_id).replace(/\.jsonl$/i, ''));
    emit();
}

export async function startChat(characterId) {
    await selectCharacterById(Number(characterId), { switchMenu: false });
    await doNewChat();
    await refreshCollections();
}

export async function sendMessage(text) {
    await getPresetApplicationPromise();
    if (connectionPending) await waitForConnection();
    if (online_status === 'no_connection' || online_status === 'no_connection_error') {
        throw new Error('AI provider is not connected. Connect it in Settings and try again.');
    }
    const textarea = document.getElementById('send_textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    textarea.value = String(text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await sendTextareaMessage();
}

export async function regenerate() {
    await getPresetApplicationPromise();
    await Generate('regenerate');
}

export async function continueMessage() {
    await getPresetApplicationPromise();
    await Generate('continue');
}

export async function swipeMessage(direction) {
    if (direction === 'left') await swipe_left(null, { source: 'button' });
    else await swipe_right(null, { source: 'button' });
}

export async function updateMessage(messageId, text) {
    if (!chat[messageId]) return;
    chat[messageId].mes = String(text);
    await saveChat();
    await eventSource.emit(event_types.MESSAGE_EDITED, Number(messageId));
}

export async function removeMessage(messageId) {
    await deleteMessage(Number(messageId), undefined, false);
}

export function attachFiles(files) {
    const input = document.getElementById('file_form_input');
    if (!(input instanceof HTMLInputElement) || !files?.length) return;
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function saveCharacter(data) {
    const id = data.id === '' || data.id === undefined ? null : Number(data.id);
    const previousAvatar = id === null ? null : characters[id]?.avatar;
    const previousAvatars = new Set(characters.map(character => character.avatar));
    if (id === null) {
        document.getElementById('rm_button_create')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } else {
        setCharacterId(id);
        select_selected_character(id, { switchMenu: false });
    }

    const fields = {
        character_name_pole: data.name,
        description_textarea: data.description,
        firstmessage_textarea: data.firstMessage,
        personality_textarea: data.personality,
        scenario_pole: data.scenario,
        mes_example_textarea: data.exampleMessages,
        tags_textarea: data.tags,
        post_history_instructions_textarea: data.postHistoryInstructions,
        system_prompt_textarea: data.systemPrompt,
        depth_prompt_prompt: data.depthPrompt,
        depth_prompt_depth: data.depthPromptDepth,
        depth_prompt_role: data.depthPromptRole,
        character_world: data.primaryLorebook,
    };
    for (const [fieldId, value] of Object.entries(fields)) {
        const field = document.getElementById(fieldId);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
            field.value = String(value ?? '');
            field.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    if (id === null) {
        create_save.alternate_greetings = Array.isArray(data.alternateGreetings) ? data.alternateGreetings : [];
        create_save.extra_books = Array.isArray(data.extraLorebooks) ? data.extraLorebooks : [];
        create_save.world = data.primaryLorebook || '';
    } else {
        const character = characters[id];
        if (character?.data) character.data.alternate_greetings = Array.isArray(data.alternateGreetings) ? data.alternateGreetings : [];
    }

    if (data.avatar instanceof File) {
        const avatarInput = document.getElementById('add_avatar_button');
        if (avatarInput instanceof HTMLInputElement) {
            const transfer = new DataTransfer();
            transfer.items.add(data.avatar);
            avatarInput.files = transfer.files;
            avatarInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    await createOrEditCharacter(new Event('submit', { cancelable: true }));
    await getCharacters();
    const savedCharacter = previousAvatar
        ? characters.find(character => character.avatar === previousAvatar)
        : characters.find(character => !previousAvatars.has(character.avatar) && character.name === data.name);
    if (!savedCharacter) throw new Error('Character could not be saved or reloaded.');
    if (id !== null) {
        const fileName = getCharaFilename(null, { manualAvatarKey: savedCharacter.avatar });
        charSetAuxWorlds(fileName, data.extraLorebooks || []);
    }
    emit();
}

export async function saveChatSettings(data) {
    if (!getCurrentChatId()) throw new Error('No active chat');
    if (data.lorebook) chat_metadata[WORLD_INFO_METADATA_KEY] = String(data.lorebook);
    else delete chat_metadata[WORLD_INFO_METADATA_KEY];
    chat_metadata[authorNoteKeys.prompt] = textValue(data.authorNote);
    chat_metadata[authorNoteKeys.interval] = Math.max(0, Number(data.authorNoteInterval) || 0);
    chat_metadata[authorNoteKeys.position] = Number(data.authorNotePosition ?? 1);
    chat_metadata[authorNoteKeys.depth] = Math.max(0, Number(data.authorNoteDepth) || 0);
    chat_metadata[authorNoteKeys.role] = Number(data.authorNoteRole ?? 0);
    chat_metadata.scenario = textValue(data.scenario);
    chat_metadata.mes_example = textValue(data.exampleMessages);
    chat_metadata.system_prompt = textValue(data.systemPrompt);
    setFloatingPrompt();
    await saveMetadata();
    emit();
}

export async function removeCharacter(characterId, deleteChats = false) {
    const character = characters[Number(characterId)];
    if (!character) throw new Error('Character not found');
    const deleted = await deleteCharacter(character.avatar, { deleteChats: Boolean(deleteChats) });
    if (!deleted) throw new Error('Character could not be deleted');
    await refreshCollections();
}

export async function removeChat(chatInfo) {
    const characterId = characters.findIndex(character => character.avatar === chatInfo.avatar);
    if (characterId < 0) throw new Error('Character not found');
    const fileName = String(chatInfo.file_name || chatInfo.file_id || '').replace(/\.jsonl$/i, '');
    const wasCurrent = Number(this_chid) === characterId && characters[characterId].chat === fileName;
    await deleteCharacterChatByName(characterId, fileName);
    if (wasCurrent) await openCharacterChat(characters[characterId].chat);
    await refreshCollections();
}

export async function importCharacter(file) {
    const input = document.getElementById('character_import_file');
    if (!(input instanceof HTMLInputElement)) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function exportCharacter(characterId) {
    const character = characters[Number(characterId)];
    if (!character) throw new Error('Character not found');
    const response = await fetch('/api/characters/export', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ format: 'png', avatar_url: character.avatar }),
    });
    if (!response.ok) throw new Error('Character could not be exported');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = character.avatar;
    link.click();
    URL.revokeObjectURL(url);
}

export async function savePersona(data) {
    let avatar = data.avatar;
    const previousDescriptor = avatar ? power_user.persona_descriptions?.[avatar] : null;
    if (data.image instanceof File || !avatar) {
        const blob = data.image instanceof File ? data.image : await (await fetch('/img/user-default.png')).blob();
        const fileName = avatar || `persona-${crypto.randomUUID()}.png`;
        const form = new FormData();
        form.append('avatar', new File([blob], fileName, { type: blob.type || 'image/png' }));
        form.append('overwrite_name', fileName);
        const upload = await fetch('/api/avatars/upload', {
            method: 'POST', headers: getRequestHeaders({ omitContentType: true }), body: form,
        });
        if (!upload.ok) throw new Error('Avatar upload failed');
        avatar = (await upload.json()).path;
    }
    await initPersona(avatar, data.name, data.description, data.title || '', {
        position: Number(data.position ?? 0),
        depth: Number(data.depth ?? 2),
        role: Number(data.role ?? 0),
        lorebook: data.lorebook || '',
    });
    if (previousDescriptor) {
        power_user.persona_descriptions[avatar] = {
            ...clone(previousDescriptor),
            ...power_user.persona_descriptions[avatar],
        };
        saveSettingsDebounced();
    }
    if (avatar === user_avatar) await setUserAvatar(avatar, { navigateToCurrent: false });
    await getUserAvatars(true, avatar);
    emit();
}

export async function selectPersona(avatar) {
    await setUserAvatar(avatar, { navigateToCurrent: false });
    emit();
}

export async function removePersona(avatar) {
    const response = await fetch('/api/avatars/delete', {
        method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ avatar }),
    });
    if (!response.ok) throw new Error('Persona could not be deleted');
    const name = power_user.personas[avatar];
    delete power_user.personas[avatar];
    delete power_user.persona_descriptions[avatar];
    saveSettingsDebounced();
    await eventSource.emit(event_types.PERSONA_DELETED, { avatarId: avatar, name });
    emit();
}

export async function getLorebook(name) {
    const response = await fetch('/api/worldinfo/get', {
        method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Lorebook could not be loaded');
    return response.json();
}

export async function saveLorebook(name, data) {
    const response = await fetch('/api/worldinfo/edit', {
        method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ name, data }),
    });
    if (!response.ok) throw new Error('Lorebook could not be saved');
    await eventSource.emit(event_types.WORLDINFO_UPDATED, name, data);
    await refreshCollections();
}

export async function removeLorebook(name) {
    const response = await fetch('/api/worldinfo/delete', {
        method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Lorebook could not be deleted');
    await refreshCollections();
}

function optionViews(selector) {
    const select = document.querySelector(selector);
    if (!(select instanceof HTMLSelectElement)) return [];
    return Array.from(select.options).filter(option => option.value).map(option => ({ id: option.value, name: option.textContent.trim() }));
}

function getActiveModelElement() {
    if (main_api === 'openai') {
        const selector = modelSelectorByProvider[oai_settings?.chat_completion_source] || '#model_custom_select';
        return document.querySelector(selector);
    }
    if (main_api === 'textgenerationwebui') {
        const selector = textModelSelectorByProvider[textgenerationwebui_settings?.type] || '#custom_model_textgenerationwebui';
        return document.querySelector(selector);
    }
    return null;
}

function getActiveModelOptions() {
    const element = getActiveModelElement();
    if (!(element instanceof HTMLSelectElement)) return [];
    return Array.from(element.options)
        .filter(option => option.value)
        .map(option => ({ id: option.value, name: option.textContent?.trim() || option.value }));
}

export function setActiveModel(model) {
    const element = getActiveModelElement();
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) {
        throw new Error('No model selector is available for the active provider.');
    }
    const value = String(model || '');
    if (element instanceof HTMLSelectElement && !Array.from(element.options).some(option => option.value === value)) {
        throw new Error('The selected model is not available.');
    }
    element.value = value;
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    saveSettingsDebounced();
    emit();
}

export async function selectChatCompletionPreset(value) {
    const manager = getPresetManager('openai');
    if (!manager) throw new Error('Chat Completion presets are not available.');
    await manager.selectPreset(String(value));
    emit();
}

export async function updateChatCompletionPreset() {
    const manager = getPresetManager('openai');
    if (!manager) throw new Error('Chat Completion presets are not available.');
    if (manager.getSelectedPreset() === 'gui') throw new Error('The default preset cannot be updated.');
    await manager.updatePreset();
    emit();
}

const excludedPresetEditorKey = /(api[_-]?key|password|proxy|url|endpoint|deployment[_-]?name|api[_-]?version|account[_-]?id|project[_-]?id|service[_-]?account|include[_-]?headers)/i;

function humanizePresetKey(key) {
    return String(key).replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function presetCategory(key) {
    if (/model|source|group_models|sort_models/.test(key)) return 'Provider and model';
    if (/temperature|penalty|top_|min_p|seed|sampling|bias/.test(key)) return 'Sampling';
    if (/context|max_token|max_context|response|token/.test(key)) return 'Context and response';
    if (/reason|thought|tool|function|web_search/.test(key)) return 'Reasoning and tools';
    if (/prompt|format|names|squash|prefill|continue|send_if_empty/.test(key)) return 'Prompts and formatting';
    if (/media|image|video|stream/.test(key)) return 'Streaming and media';
    return 'Other';
}

export function getChatCompletionPresetEditor() {
    const manager = getPresetManager('openai');
    if (!manager) throw new Error('Chat Completion presets are not available.');
    const id = String(manager.getSelectedPreset() ?? '');
    if (!id || id === 'gui') throw new Error('The default preset cannot be updated.');
    const name = manager.getSelectedPresetName();
    const values = getChatCompletionPreset(oai_settings);
    const prompts = Array.isArray(values.prompts) ? clone(values.prompts) : [];
    const promptOrders = Array.isArray(values.prompt_order) ? values.prompt_order : [];
    const fallbackPromptOrder = promptOrders.find(entry => Array.isArray(entry?.order));
    const globalPromptOrder = promptOrders.find(entry => Number(entry?.character_id) === 100001)
        || { character_id: 100001, order: clone(fallbackPromptOrder?.order || []) };
    const promptById = new Map(prompts.map(prompt => [prompt.identifier, prompt]));
    const promptOrder = (globalPromptOrder.order || [])
        .filter(entry => promptById.has(entry.identifier))
        .map(entry => ({ identifier: entry.identifier, enabled: entry.enabled !== false }));
    for (const prompt of prompts) {
        if (!promptOrder.some(entry => entry.identifier === prompt.identifier)) {
            promptOrder.push({ identifier: prompt.identifier, enabled: true });
        }
    }
    const fields = [];
    for (const [key, value] of Object.entries(values)) {
        if (excludedPresetEditorKey.test(key) || value === undefined || key === 'prompts' || key === 'prompt_order') continue;
        const category = presetCategory(key);
        if (category === 'Provider and model' || category === 'Other') continue;
        const selector = settingsToUpdate[key]?.[0];
        const element = selector ? document.querySelector(selector) : null;
        const options = element instanceof HTMLSelectElement
            ? Array.from(element.options).map(option => ({ id: option.value, name: option.textContent?.trim() || option.value }))
            : [];
        const type = Array.isArray(value) ? 'array' : value === null ? 'object' : typeof value;
        fields.push({
            key,
            label: humanizePresetKey(key),
            category,
            type,
            value: clone(value),
            options,
        });
    }
    return {
        id,
        name,
        fields,
        values: clone(values),
        prompts,
        promptOrder,
        promptOrderCharacterId: Number(globalPromptOrder.character_id) || 100001,
    };
}

export async function saveChatCompletionPresetDraft(name, draft) {
    const manager = getPresetManager('openai');
    if (!manager) throw new Error('Chat Completion presets are not available.');
    if (manager.getSelectedPreset() === 'gui') throw new Error('The default preset cannot be updated.');
    const normalized = String(name || '').trim();
    if (!normalized) throw new Error('Enter a preset name.');
    await manager.savePreset(normalized, clone(draft));
    await getPresetApplicationPromise();
    emit();
}

export async function saveChatCompletionPresetAs(name) {
    const manager = getPresetManager('openai');
    if (!manager) throw new Error('Chat Completion presets are not available.');
    const normalized = String(name || '').trim();
    if (!normalized) throw new Error('Enter a preset name.');
    await manager.savePreset(normalized);
    emit();
}

export function setGlobalLorebooks(names) {
    const selected = new Set((Array.isArray(names) ? names : []).map(String));
    const select = document.getElementById('world_info');
    if (!(select instanceof HTMLSelectElement)) throw new Error('Global lorebook settings are not available.');
    for (const option of select.options) {
        option.selected = selected.has(option.textContent?.trim() || '');
    }
    onWorldInfoChange('__notSlashCommand__');
    emit();
}

const modelSelectorByProvider = Object.fromEntries(Object.entries(settingsToUpdate)
    .filter(([key, value]) => key.endsWith('_model') && value[0])
    .map(([key, value]) => [key.replace(/_model$/, ''), value[0]]));
modelSelectorByProvider.custom = '#model_custom_select';

const textModelSelectorByProvider = {
    mancer: '#mancer_model',
    vllm: '#vllm_model',
    aphrodite: '#aphrodite_model',
    tabby: '#tabby_model',
    togetherai: '#model_togetherai_select',
    llamacpp: '#llamacpp_model',
    ollama: '#ollama_model',
    infermaticai: '#model_infermaticai_select',
    dreamgen: '#model_dreamgen_select',
    openrouter: '#openrouter_model',
    featherless: '#featherless_model',
    generic: '#generic_model_select',
};

function hasSecret(key) {
    if (!key) return false;
    const value = secret_state[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

export function getConnectionCatalog() {
    const modelsByProvider = {};
    for (const [provider, selector] of Object.entries(modelSelectorByProvider)) {
        modelsByProvider[provider] = optionViews(selector);
    }
    const textModelsByProvider = {};
    for (const [provider, selector] of Object.entries(textModelSelectorByProvider)) {
        textModelsByProvider[provider] = optionViews(selector);
    }
    return {
        families: optionViews('#main_api'),
        chatCompletion: optionViews('#chat_completion_source'),
        textCompletion: optionViews('#textgen_type'),
        modelsByProvider,
        textModelsByProvider,
        keySavedByProvider: Object.fromEntries(Object.entries(secretByProvider).map(([provider, key]) => [provider, hasSecret(key)])),
        keySavedByFamily: Object.fromEntries(Object.entries(secretByFamily).map(([family, key]) => [family, hasSecret(key)])),
    };
}

const secretByProvider = {
    openai: SECRET_KEYS.OPENAI,
    claude: SECRET_KEYS.CLAUDE,
    openrouter: SECRET_KEYS.OPENROUTER,
    ai21: SECRET_KEYS.AI21,
    makersuite: SECRET_KEYS.MAKERSUITE,
    vertexai: SECRET_KEYS.VERTEXAI,
    custom: SECRET_KEYS.CUSTOM,
    mistralai: SECRET_KEYS.MISTRALAI,
    cohere: SECRET_KEYS.COHERE,
    perplexity: SECRET_KEYS.PERPLEXITY,
    groq: SECRET_KEYS.GROQ,
    electronhub: SECRET_KEYS.ELECTRONHUB,
    deepseek: SECRET_KEYS.DEEPSEEK,
    xai: SECRET_KEYS.XAI,
    chutes: SECRET_KEYS.CHUTES,
    nanogpt: SECRET_KEYS.NANOGPT,
    aimlapi: SECRET_KEYS.AIMLAPI,
    minimax: SECRET_KEYS.MINIMAX,
    moonshot: SECRET_KEYS.MOONSHOT,
    fireworks: SECRET_KEYS.FIREWORKS,
    cometapi: SECRET_KEYS.COMETAPI,
    azure_openai: SECRET_KEYS.AZURE_OPENAI,
    zai: SECRET_KEYS.ZAI,
    siliconflow: SECRET_KEYS.SILICONFLOW,
    pollinations: SECRET_KEYS.POLLINATIONS,
    workers_ai: SECRET_KEYS.WORKERS_AI,
    ooba: SECRET_KEYS.OOBA,
    mancer: SECRET_KEYS.MANCER,
    vllm: SECRET_KEYS.VLLM,
    aphrodite: SECRET_KEYS.APHRODITE,
    tabby: SECRET_KEYS.TABBY,
    togetherai: SECRET_KEYS.TOGETHERAI,
    koboldcpp: SECRET_KEYS.KOBOLDCPP,
    llamacpp: SECRET_KEYS.LLAMACPP,
    infermaticai: SECRET_KEYS.INFERMATICAI,
    dreamgen: SECRET_KEYS.DREAMGEN,
    featherless: SECRET_KEYS.FEATHERLESS,
    huggingface: SECRET_KEYS.HUGGINGFACE,
    generic: SECRET_KEYS.GENERIC,
};

const secretByFamily = {
    novel: SECRET_KEYS.NOVEL,
    koboldhorde: SECRET_KEYS.HORDE,
};

function getConnectButton() {
    if (main_api === 'openai') return '#api_button_openai';
    if (main_api === 'textgenerationwebui') return '#api_button_textgenerationwebui';
    if (main_api === 'novel') return '#api_button_novel';
    return '#api_button';
}

function waitForConnection(timeout = 30000) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
            if (online_status !== 'no_connection' && online_status !== 'no_connection_error') {
                clearInterval(timer);
                resolve();
            } else if (online_status === 'no_connection_error' || Date.now() - startedAt >= timeout) {
                clearInterval(timer);
                reject(new Error('AI provider connection failed or timed out.'));
            }
        }, 100);
    });
}

function runConnection(selector) {
    if (connectionPromise) return connectionPromise;
    connectionPending = true;
    connectionError = '';
    emit();
    document.querySelector(selector)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    connectionPromise = waitForConnection().catch(error => {
        connectionError = error?.message || 'AI provider connection failed.';
        throw error;
    }).finally(() => {
        connectionPending = false;
        connectionPromise = null;
        emit();
    });
    return connectionPromise;
}

export function reconnectLastServer() {
    return runConnection(getConnectButton());
}

export async function connect(config) {
    const mainSelect = document.getElementById('main_api');
    if (!(mainSelect instanceof HTMLSelectElement)) return;
    mainSelect.value = config.family;
    mainSelect.dispatchEvent(new Event('change', { bubbles: true }));

    let connectButton = '#api_button';
    if (config.family === 'openai') {
        const source = document.getElementById('chat_completion_source');
        if (source instanceof HTMLSelectElement && config.provider) {
            source.value = config.provider;
            source.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (config.apiKey && secretByProvider[config.provider]) {
            await writeSecret(secretByProvider[config.provider], config.apiKey);
        }
        if (config.url) {
            const urlInput = document.getElementById('custom_api_url_text');
            if (urlInput instanceof HTMLInputElement) {
                urlInput.value = config.url;
                urlInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        if (config.model) {
            const candidates = [modelSelectorByProvider[config.provider], '#model_custom_select', '#custom_model_id'].filter(Boolean);
            const modelInput = candidates.map(selector => document.querySelector(selector)).find(Boolean);
            if (modelInput instanceof HTMLInputElement || modelInput instanceof HTMLSelectElement) {
                modelInput.value = config.model;
                modelInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        connectButton = '#api_button_openai';
    } else if (config.family === 'textgenerationwebui') {
        const type = document.getElementById('textgen_type');
        if (type instanceof HTMLSelectElement && config.provider) {
            type.value = config.provider;
            type.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const serverSelector = SERVER_INPUTS[config.provider];
        const server = serverSelector ? document.querySelector(serverSelector) : null;
        if (config.url && server instanceof HTMLInputElement) server.value = config.url;
        if (config.apiKey && secretByProvider[config.provider]) await writeSecret(secretByProvider[config.provider], config.apiKey);
        if (config.model) {
            const modelInput = document.querySelector(textModelSelectorByProvider[config.provider] || '#custom_model_textgenerationwebui');
            if (modelInput instanceof HTMLInputElement || modelInput instanceof HTMLSelectElement) {
                modelInput.value = config.model;
                modelInput.dispatchEvent(new Event(modelInput instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
            }
        }
        connectButton = '#api_button_textgenerationwebui';
    } else if (config.family === 'novel') {
        if (config.apiKey) await writeSecret(SECRET_KEYS.NOVEL, config.apiKey);
        connectButton = '#api_button_novel';
    } else if (config.family === 'koboldhorde') {
        if (config.apiKey) await writeSecret(SECRET_KEYS.HORDE, config.apiKey);
        connectButton = '#api_button';
    } else if (config.url) {
        const urlInput = document.getElementById('api_url_text');
        if (urlInput instanceof HTMLInputElement) urlInput.value = config.url;
    }

    await runConnection(connectButton);
}

export async function downloadBackup() {
    const handle = currentUser?.handle || 'default-user';
    const response = await fetch('/api/users/backup', {
        method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ handle }),
    });
    if (!response.ok) throw new Error('Backup could not be created');
    const blob = await response.blob();
    const header = response.headers.get('Content-Disposition') || '';
    const match = header.match(/filename="?([^";]+)"?/i);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = match?.[1] || `easiertavern-${handle}-backup.zip`;
    link.click();
    URL.revokeObjectURL(url);
}

