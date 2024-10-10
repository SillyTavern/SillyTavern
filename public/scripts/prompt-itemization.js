import { renderTemplateAsync } from './templates.js';
import { Popup, POPUP_TYPE } from './popup.js';
import { t } from './i18n.js';
import { getFriendlyTokenizerName, getTokenCountAsync } from './tokenizers.js';
import { oai_settings } from './openai.js';
import { power_user, registerDebugFunction } from './power-user.js';
import { chat, event_types, eventSource, getCurrentChatId, getNextMessageId, reloadCurrentChat } from '../script.js';

export const promptStorage = new localforage.createInstance({ name: 'SillyTavern_Prompts' });

const name = '[Prompt Itemization]';

// Array for prompt token calculations
console.debug(`${name} initializing Prompt Itemization array`);
export let itemizedPrompts = [];


// Storage management

/**
 * Gets the itemized prompts for a chat.
 * Called by getChatResult in script.js, shortly before CHAT_CHANGED is emitted.
 * (therefore it may be possible to do this in response to CHAT_CHANGED instead)
 * @param {string} chatId Chat ID to load
 */
export async function loadItemizedPrompts(chatId) {
    try {
        if (!chatId) {
            itemizedPrompts = [];
            return;
        }

        itemizedPrompts = await promptStorage.getItem(chatId);

        if (!itemizedPrompts) {
            itemizedPrompts = [];
        }
    } catch {
        console.log(`${name} Error loading itemized prompts for chat`, chatId);
        itemizedPrompts = [];
    }
}

/**
 * Saves the itemized prompts for a chat.
 * @param {string} chatId Chat ID to save itemized prompts for
 */
export async function saveItemizedPrompts(chatId) {
    try {
        if (!chatId) {
            return;
        }

        await promptStorage.setItem(chatId, itemizedPrompts);
    } catch (e) {
        console.warn(`${name} Error saving itemized prompts for chat: ${e}`, chatId, itemizedPrompts);
        console.trace(e);
    }
}

/**
 * Deletes the itemized prompts for a chat.
 * @param {string} chatId Chat ID to delete itemized prompts for
 */
async function deleteItemizedPrompts(chatId) {
    try {
        if (!chatId) {
            return;
        }

        await promptStorage.removeItem(chatId);
    } catch (e) {
        console.warn(`${name} Error deleting itemized prompts for chat: ${e}`, chatId);
    }
}

/**
 * Unloads the itemized prompts array.
 * @returns {Promise<void>}
 */
export async function unloadItemizedPrompts() {
    itemizedPrompts = [];
}

/**
 * Empties the itemized prompts array and caches.
 */
async function clearItemizedPrompts() {
    try {
        await promptStorage.clear();
        await unloadItemizedPrompts();
    } catch (e) {
        console.warn(`${name} Error clearing itemized prompts: ${e}`);
    }
}


// Add/update itemized prompts

/**
 * Gets the itemized prompt for a message.
 * @param {number} mesId Message ID to get itemized prompt for
 * @returns {any} Itemized prompt object or undefined
 */
function getItemizedPromptForMesId(mesId) {
    if (!Array.isArray(itemizedPrompts)) {
        itemizedPrompts = [];
    }

    return itemizedPrompts.find(x => x.mesId === mesId);
}

/**
 * Saves the itemized prompt for a message.
 * @param additionalPromptStuff
 */
export function saveItemizedPrompt(additionalPromptStuff) {
    const itemizedIndex = itemizedPrompts.findIndex((item) => item.mesId === additionalPromptStuff.mesId);

    if (itemizedIndex !== -1) {
        const existingItem = itemizedPrompts[itemizedIndex];

        if (additionalPromptStuff.generationSettings) {
            console.warn(`${name} saveItemizedPrompt: generationSettings unexpected for ${additionalPromptStuff.mesId}`);
        }

        // keep the existing generationSettings if it's already set
        // because it may have been set earlier in the generation process
        itemizedPrompts[itemizedIndex] = {
            ...existingItem.generationSettings && { generationSettings: existingItem.generationSettings },
            ...additionalPromptStuff,
        };
    } else {
        itemizedPrompts.push(additionalPromptStuff);
    }

    console.debug(`${name} pushed additionalPromptStuff for ${additionalPromptStuff.mesId} to itemizedPrompts`);
}

/**
 * Parses the token counts for a message.
 * @param counts
 * @param thisPromptBits
 * @returns {void}
 */
export function parseTokenCounts(counts, thisPromptBits) {
    /**
     * @param {any[]} numbers
     */
    function getSum(...numbers) {
        return numbers.map(x => Number(x)).filter(x => !Number.isNaN(x)).reduce((acc, val) => acc + val, 0);
    }

    const total = getSum(Object.values(counts));

    thisPromptBits.push({
        oaiStartTokens: (counts?.start + counts?.controlPrompts) || 0,
        oaiPromptTokens: getSum(counts?.prompt, counts?.charDescription, counts?.charPersonality, counts?.scenario) || 0,
        oaiBiasTokens: counts?.bias || 0,
        oaiNudgeTokens: counts?.nudge || 0,
        oaiJailbreakTokens: counts?.jailbreak || 0,
        oaiImpersonateTokens: counts?.impersonate || 0,
        oaiExamplesTokens: (counts?.dialogueExamples + counts?.examples) || 0,
        oaiConversationTokens: (counts?.conversation + counts?.chatHistory) || 0,
        oaiNsfwTokens: counts?.nsfw || 0,
        oaiMainTokens: counts?.main || 0,
        oaiTotalTokens: total,
    });
    // console.debug(`[Prompt Itemization] parseTokenCounts pushed to idx ${thisPromptBits.length - 1}`);
}

/**
 * Saves the prompt text for a message.
 * Called only by sendAltScaleRequest because the prompt is regenerated there.
 * In general, the prompt text should be saved as
 * @param {number} mesId Message ID to get itemized prompt for
 * @param {string} promptText New raw prompt text
 * @returns
 */
export async function saveItemizedPromptText(mesId, promptText) {
    const itemizedPrompt = getItemizedPromptForMesId(mesId);

    if (!itemizedPrompt) {
        console.warn(`${name} No itemized prompt found for message ${mesId}`);
        return;
    }

    itemizedPrompt.rawPrompt = promptText;
}

/**
 * Saves the generation settings for a message.
 * @param {number} mesId Message ID to get itemized prompt for
 * @param {object} generationSettings Raw request object
 * @returns {Promise<void>}
 */
async function saveGenerationSettings(mesId, generationSettings) {
    console.debug(`${name} savegenerationSettings for ${mesId}`);

    const itemizedPrompt = getItemizedPromptForMesId(mesId);

    if (!itemizedPrompt) {
        console.warn(`${name} No itemized prompt found for message ${mesId}`);
        return;
    }

    if (generationSettings.tools) {
        // HACK: stringify and unstringify to remove toString() functions
        const generationSettingsCopy = { ...generationSettings };
        generationSettingsCopy.tools = JSON.parse(JSON.stringify(generationSettingsCopy.tools));
        itemizedPrompt.generationSettings = generationSettingsCopy;
        return;
    }

    itemizedPrompt.generationSettings = generationSettings;
}

/**
 * Saves the generation response for a message.
 * @param {number} mesId Message ID to get itemized prompt for
 * @param {object} generationResponse Raw response object
 * @returns {Promise<void>}
 */
async function saveGenerationResponse(mesId, generationResponse) {
    const itemizedPrompt = getItemizedPromptForMesId(mesId);

    console.debug(`${name} savegenerationResponse for message ${mesId}`);

    if (itemizedPrompt) {
        itemizedPrompt.generationResponse = generationResponse;
        // console.debug(`${name} itemizedPrompt ${mesId} now`, itemizedPrompt);
    } else {
        console.warn(`${name} No itemized prompt found for message ${mesId}`);
    }
}


// UI

let PromptArrayItemForRawPromptDisplay;
let priorPromptArrayItemForRawPromptDisplay;

/**
 * Builds the itemized prompt parameters for a message.
 * @param itemizedPrompts
 * @param thisPromptSet
 * @param incomingMesId
 * @returns {Promise<{scenarioTextTokens: number, thisPrompt_padding, chatVectorsStringTokens: number, worldInfoStringTokens: number, afterScenarioAnchorTokens: number, this_main_api: (string|*), charPersonalityTokens: number, beforeScenarioAnchorTokens: number, authorsNoteStringTokens: number, modelUsed: *, zeroDepthAnchorTokens: number, userPersonaStringTokens: number, chatInjects: number, dataBankVectorsStringTokens: number, allAnchorsTokens: number, apiUsed: *, smartContextStringTokens: number, summarizeStringTokens: number, charDescriptionTokens: number}>}
 */
async function itemizedParams(itemizedPrompts, thisPromptSet, incomingMesId) {
    const params = {
        charDescriptionTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].charDescription),
        charPersonalityTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].charPersonality),
        scenarioTextTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].scenarioText),
        userPersonaStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].userPersona),
        worldInfoStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].worldInfoString),
        allAnchorsTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].allAnchors),
        summarizeStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].summarizeString),
        authorsNoteStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].authorsNoteString),
        smartContextStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].smartContextString),
        beforeScenarioAnchorTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].beforeScenarioAnchor),
        afterScenarioAnchorTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].afterScenarioAnchor),
        zeroDepthAnchorTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].zeroDepthAnchor), // TODO: unused
        thisPrompt_padding: itemizedPrompts[thisPromptSet].padding,
        this_main_api: itemizedPrompts[thisPromptSet].main_api,
        chatInjects: await getTokenCountAsync(itemizedPrompts[thisPromptSet].chatInjects),
        chatVectorsStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].chatVectorsString),
        dataBankVectorsStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].dataBankVectorsString),
        modelUsed: chat[incomingMesId]?.extra?.model,
        apiUsed: chat[incomingMesId]?.extra?.api,
    };

    const getFriendlyName = (value) => $(`#rm_api_block select option[value="${value}"]`).first().text() || value;

    if (params.apiUsed) {
        params.apiUsed = getFriendlyName(params.apiUsed);
    }

    if (params.this_main_api) {
        params.mainApiFriendlyName = getFriendlyName(params.this_main_api);
    }

    if (params.chatInjects) {
        params.ActualChatHistoryTokens = params.ActualChatHistoryTokens - params.chatInjects;
    }

    if (params.this_main_api === 'openai') {
        //for OAI API
        //console.log('-- Counting OAI Tokens');

        //params.finalPromptTokens = itemizedPrompts[thisPromptSet].oaiTotalTokens;
        params.oaiMainTokens = itemizedPrompts[thisPromptSet].oaiMainTokens;
        params.oaiStartTokens = itemizedPrompts[thisPromptSet].oaiStartTokens;
        params.ActualChatHistoryTokens = itemizedPrompts[thisPromptSet].oaiConversationTokens;
        params.examplesStringTokens = itemizedPrompts[thisPromptSet].oaiExamplesTokens;
        params.oaiPromptTokens = itemizedPrompts[thisPromptSet].oaiPromptTokens - (params.afterScenarioAnchorTokens + params.beforeScenarioAnchorTokens) + params.examplesStringTokens;
        params.oaiBiasTokens = itemizedPrompts[thisPromptSet].oaiBiasTokens;
        params.oaiJailbreakTokens = itemizedPrompts[thisPromptSet].oaiJailbreakTokens;
        params.oaiNudgeTokens = itemizedPrompts[thisPromptSet].oaiNudgeTokens;
        params.oaiImpersonateTokens = itemizedPrompts[thisPromptSet].oaiImpersonateTokens;
        params.oaiNsfwTokens = itemizedPrompts[thisPromptSet].oaiNsfwTokens;
        params.finalPromptTokens =
            params.oaiStartTokens +
            params.oaiPromptTokens +
            params.oaiMainTokens +
            params.oaiNsfwTokens +
            params.oaiBiasTokens +
            params.oaiImpersonateTokens +
            params.oaiJailbreakTokens +
            params.oaiNudgeTokens +
            params.ActualChatHistoryTokens +
            //charDescriptionTokens +
            //charPersonalityTokens +
            //allAnchorsTokens +
            params.worldInfoStringTokens +
            params.beforeScenarioAnchorTokens +
            params.afterScenarioAnchorTokens;
        // Max context size - max completion tokens
        params.thisPrompt_max_context = (oai_settings.openai_max_context - oai_settings.openai_max_tokens);

        //console.log('-- applying % on OAI tokens');
        params.oaiStartTokensPercentage = ((params.oaiStartTokens / (params.finalPromptTokens)) * 100).toFixed(2);
        params.storyStringTokensPercentage = (((params.afterScenarioAnchorTokens + params.beforeScenarioAnchorTokens + params.oaiPromptTokens) / (params.finalPromptTokens)) * 100).toFixed(2);
        params.ActualChatHistoryTokensPercentage = ((params.ActualChatHistoryTokens / (params.finalPromptTokens)) * 100).toFixed(2);
        params.promptBiasTokensPercentage = ((params.oaiBiasTokens / (params.finalPromptTokens)) * 100).toFixed(2);
        params.worldInfoStringTokensPercentage = ((params.worldInfoStringTokens / (params.finalPromptTokens)) * 100).toFixed(2);
        params.allAnchorsTokensPercentage = ((params.allAnchorsTokens / (params.finalPromptTokens)) * 100).toFixed(2);
        params.selectedTokenizer = getFriendlyTokenizerName(params.this_main_api).tokenizerName;
        params.oaiSystemTokens = params.oaiImpersonateTokens + params.oaiJailbreakTokens + params.oaiNudgeTokens + params.oaiStartTokens + params.oaiNsfwTokens + params.oaiMainTokens;
        params.oaiSystemTokensPercentage = ((params.oaiSystemTokens / (params.finalPromptTokens)) * 100).toFixed(2);
    } else {
        //for non-OAI APIs
        //console.log('-- Counting non-OAI Tokens');
        params.finalPromptTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].finalPrompt);
        params.storyStringTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].storyString) - params.worldInfoStringTokens;
        params.examplesStringTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].examplesString);
        params.mesSendStringTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].mesSendString);
        params.ActualChatHistoryTokens = params.mesSendStringTokens - (params.allAnchorsTokens - (params.beforeScenarioAnchorTokens + params.afterScenarioAnchorTokens)) + power_user.token_padding;
        params.instructionTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].instruction);
        params.promptBiasTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].promptBias);

        params.totalTokensInPrompt =
            params.storyStringTokens +     //chardefs total
            params.worldInfoStringTokens +
            params.examplesStringTokens + // example messages
            params.ActualChatHistoryTokens +  //chat history
            params.allAnchorsTokens +      // AN and/or legacy anchors
            //afterScenarioAnchorTokens +       //only counts if AN is set to 'after scenario'
            //zeroDepthAnchorTokens +           //same as above, even if AN not on 0 depth
            params.promptBiasTokens;       //{{}}
        //- thisPrompt_padding;  //not sure this way of calculating is correct, but the math results in same value as 'finalPrompt'
        params.thisPrompt_max_context = itemizedPrompts[thisPromptSet].this_max_context;
        params.thisPrompt_actual = params.thisPrompt_max_context - params.thisPrompt_padding;

        //console.log('-- applying % on non-OAI tokens');
        params.storyStringTokensPercentage = ((params.storyStringTokens / (params.totalTokensInPrompt)) * 100).toFixed(2);
        params.ActualChatHistoryTokensPercentage = ((params.ActualChatHistoryTokens / (params.totalTokensInPrompt)) * 100).toFixed(2);
        params.promptBiasTokensPercentage = ((params.promptBiasTokens / (params.totalTokensInPrompt)) * 100).toFixed(2);
        params.worldInfoStringTokensPercentage = ((params.worldInfoStringTokens / (params.totalTokensInPrompt)) * 100).toFixed(2);
        params.allAnchorsTokensPercentage = ((params.allAnchorsTokens / (params.totalTokensInPrompt)) * 100).toFixed(2);
        params.selectedTokenizer = itemizedPrompts[thisPromptSet]?.tokenizer || getFriendlyTokenizerName(params.this_main_api).tokenizerName;
    }
    return params;
}

function findItemizedPromptSet(itemizedPrompts, incomingMesId) {
    let thisPromptSet = undefined;

    for (let i = 0; i < itemizedPrompts.length; i++) {
        if (itemizedPrompts[i].mesId === incomingMesId) {
            thisPromptSet = i;
            PromptArrayItemForRawPromptDisplay = i;
            break;
        } else if (itemizedPrompts[i].rawPrompt) {
            priorPromptArrayItemForRawPromptDisplay = i;
        }
    }
    return thisPromptSet;
}

/**
 * Display the Prompt Itemization popup.
 * @param itemizedPrompts
 * @param requestedMesId
 * @returns {Promise<null>}
 */
async function promptItemize(itemizedPrompts, requestedMesId) {
    console.log(`${name} PROMPT ITEMIZE ENTERED`);
    const incomingMesId = Number(requestedMesId);
    const thisPromptSet = findItemizedPromptSet(itemizedPrompts, incomingMesId);

    if (thisPromptSet === undefined) {
        return null;
    }

    const params = await itemizedParams(itemizedPrompts, thisPromptSet, incomingMesId);
    const flatten = (rawPrompt) => Array.isArray(rawPrompt) ? rawPrompt.map(x => x.content).join('\n') : rawPrompt;

    const template = params.this_main_api === 'openai'
        ? await renderTemplateAsync('itemizationChat', params)
        : await renderTemplateAsync('itemizationText', params);

    const popup = new Popup(template, POPUP_TYPE.TEXT);

    /** @type {HTMLElement} */
    const diffPrevPrompt = popup.dlg.querySelector('#diffPrevPrompt');
    if (priorPromptArrayItemForRawPromptDisplay) {
        diffPrevPrompt.style.display = '';
        diffPrevPrompt.addEventListener('click', function () {
            const dmp = new diff_match_patch();
            const text1 = flatten(itemizedPrompts[priorPromptArrayItemForRawPromptDisplay].rawPrompt);
            const text2 = flatten(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt);

            dmp.Diff_Timeout = 2.0;

            const d = dmp.diff_main(text1, text2);
            let ds = dmp.diff_prettyHtml(d);
            // make it readable
            ds = ds.replaceAll('background:#e6ffe6;', 'background:#b9f3b9; color:black;');
            ds = ds.replaceAll('background:#ffe6e6;', 'background:#f5b4b4; color:black;');
            ds = ds.replaceAll('&para;', '');
            const container = document.createElement('div');
            container.innerHTML = DOMPurify.sanitize(ds);
            const rawPromptWrapper = document.getElementById('rawPromptWrapper');
            rawPromptWrapper.replaceChildren(container);
            $('#rawPromptPopup').slideToggle();
        });
    } else {
        diffPrevPrompt.style.display = 'none';
    }

    popup.dlg.querySelector('#copyPromptToClipboard').addEventListener('click', function () {
        let rawPrompt = itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt;
        let rawPromptValues = rawPrompt;

        if (Array.isArray(rawPrompt)) {
            rawPromptValues = rawPrompt.map(x => x.content).join('\n');
        }

        navigator.clipboard.writeText(rawPromptValues);
        toastr.info(t`Copied!`);
    });

    popup.dlg.querySelector('#showRawPrompt').addEventListener('click', function () {
        const rawPrompt = flatten(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt);

        const rawPromptWrapper = document.getElementById('rawPromptWrapper');
        rawPromptWrapper.innerText = rawPrompt;
        $('#rawPromptPopup').slideToggle();
    });

    function convertAndOpen(obj) {
        const jsonString = JSON.stringify(obj, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    const generationSettingsBtn = popup.dlg.querySelector('#showGenerationSettings');
    if (generationSettingsBtn) {
        const generationSettings = itemizedPrompts[PromptArrayItemForRawPromptDisplay].generationSettings;
        generationSettings ? generationSettingsBtn.disabled = false : generationSettingsBtn.disabled = true;
        generationSettingsBtn.addEventListener('click', () => convertAndOpen(generationSettings || {}));
    }

    const generationResponseBtn = popup.dlg.querySelector('#showGenerationResponse');
    if (generationResponseBtn) {
        const generationResponse = itemizedPrompts[PromptArrayItemForRawPromptDisplay].generationResponse;
        generationResponse ? generationSettingsBtn.disabled = false : generationSettingsBtn.disabled = true;
        generationResponseBtn.addEventListener('click', () => convertAndOpen(generationResponse || {}));
    }

    await popup.show();
}


/**
 * Show or hide the prompt itemization button for a message.
 * Called by addOneMessage in script.js.
 * @param {String} type
 * @param {Number} mesId
 * @param {Boolean} isUser
 * @param {JQuery<HTMLElement>} newMessage
 */
export function showHidePromptItemizationButton(type, mesId, isUser, newMessage) {
    let mesIdToFind = type === 'swipe' ? mesId - 1 : mesId;

    //if we have itemized messages, and the array isn't null..
    if (isUser === false && Array.isArray(itemizedPrompts) && itemizedPrompts.length > 0) {
        const itemizedPrompt = itemizedPrompts.find(x => Number(x.mesId) === Number(mesIdToFind));
        if (itemizedPrompt) {
            newMessage.find('.mes_prompt').show();
        }
    }
}


// Setup

/**
 * Registers prompt itemization handlers.
 * Called by script.js on document ready.
 */
export function registerPromptItemizationHandlers() {
    $(document).on('pointerup', '.mes_prompt', async function () {
        let mesIdForItemization = $(this).closest('.mes').attr('mesId');
        if (itemizedPrompts.length !== undefined && itemizedPrompts.length !== 0) {
            await promptItemize(itemizedPrompts, mesIdForItemization);
        }
    });

    eventSource.on(event_types.CHAT_DELETED, async (name) => {
        await deleteItemizedPrompts(name);
    });
    eventSource.on(event_types.GROUP_CHAT_DELETED, async (name) => {
        await deleteItemizedPrompts(name);
    });
    eventSource.on(event_types.GENERATION_SUCCESS, async (data) => {
        const messageId = data.messageId;
        // console.log(`${name} Handling event: GENERATION_SUCCESS for message ${messageId} (stream: ${data.fromStream})`);
        void saveGenerationResponse(messageId, data);
    });
    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, async (generate_data, type) => {
        const messageId = getNextMessageId(type);
        // console.log(`${name} Handling event: CHAT_COMPLETION_SETTINGS_READY for ${messageId}`);
        void saveGenerationSettings(messageId, generate_data);
    });
    eventSource.on(event_types.TEXT_COMPLETION_SETTINGS_READY, async (generate_data, type) => {
        const messageId = getNextMessageId(type);
        // console.log(`${name} Handling event: TEXT_COMPLETION_SETTINGS_READY for ${messageId}`, type);
        void saveGenerationSettings(messageId, generate_data);
    });

    // eventSource.on(event_types.GENERATION_STARTED, async (type, params, dryRun) => {
    //     console.log(`${name} Handling event: GENERATION_STARTED (type: ${type}, dryRun: ${dryRun})`);
    // });
    // eventSource.on(event_types.GENERATION_ENDED, async (messageId) => {
    //     console.log(`${name} Handling event: GENERATION_ENDED for ${messageId}`);
    // });
    // eventSource.on(event_types.GENERATE_AFTER_DATA, async () => {
    //     console.log(`${name} Handling event: GENERATE_AFTER_DATA`);
    // });
    // eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, async (chat, dryRun) => {
    //     console.log(`${name} Handling event: CHAT_COMPLETION_PROMPT_READY (dryRun: ${dryRun})`);
    // });

    registerDebugFunction('clearPrompts', 'Delete itemized prompts', 'Deletes all itemized prompts from the local storage.', async () => {
        await clearItemizedPrompts();
        toastr.info('Itemized prompts deleted.');
        if (getCurrentChatId()) {
            await reloadCurrentChat();
        }
    });
}
