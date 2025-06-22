import { Fuse } from '../../../lib.js';

import { characters, eventSource, event_types, generateQuietPrompt, generateRaw, getRequestHeaders, main_api, online_status, saveSettingsDebounced, substituteParams, substituteParamsExtended, system_message_types, this_chid } from '../../../script.js';
import { dragElement, isMobile } from '../../RossAscends-mods.js';
import { getContext, getApiUrl, modules, extension_settings, ModuleWorkerWrapper, doExtrasFetch, renderExtensionTemplateAsync } from '../../extensions.js';
import { loadMovingUIState, performFuzzySearch, power_user } from '../../power-user.js';
import { onlyUnique, debounce, getCharaFilename, trimToEndSentence, trimToStartSentence, waitUntilCondition, findChar, isFalseBoolean } from '../../utils.js';
import { hideMutedSprites, selected_group } from '../../group-chats.js';
import { isJsonSchemaSupported } from '../../textgen-settings.js';
import { debounce_timeout } from '../../constants.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue, enumTypes } from '../../slash-commands/SlashCommandEnumValue.js';
import { commonEnumProviders } from '../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { slashCommandReturnHelper } from '../../slash-commands/SlashCommandReturnHelper.js';
import { generateWebLlmChatPrompt, isWebLlmSupported } from '../shared.js';
import { Popup, POPUP_RESULT } from '../../popup.js';
import { t } from '../../i18n.js';
import { removeReasoningFromString } from '../../reasoning.js';
export { MODULE_NAME };

/**
* @typedef {object} Expression Expression definition with label and file path
* @property {string} label The label of the expression
* @property {ExpressionImage[]} files One or more images to represent this expression
*/

/**
 * @typedef {object} ExpressionImage An expression image
 * @property {string} expression - The expression
 * @property {boolean} [isCustom=false] - If the expression is added by user
 * @property {string} fileName - The filename with extension
 * @property {string} title - The title for the image
 * @property {string} imageSrc - The image source / full path
 * @property {'success' | 'additional' | 'failure'} type - The type of the image
 */

const MODULE_NAME = 'expressions';
const UPDATE_INTERVAL = 2000;
const STREAMING_UPDATE_INTERVAL = 10000;
const DEFAULT_FALLBACK_EXPRESSION = 'joy';
const DEFAULT_LLM_PROMPT = 'Ignore previous instructions. Classify the emotion of the last message. Output just one word, e.g. "joy" or "anger". Choose only one of the following labels: {{labels}}';
const DEFAULT_EXPRESSIONS = [
    'admiration',
    'amusement',
    'anger',
    'annoyance',
    'approval',
    'caring',
    'confusion',
    'curiosity',
    'desire',
    'disappointment',
    'disapproval',
    'disgust',
    'embarrassment',
    'excitement',
    'fear',
    'gratitude',
    'grief',
    'joy',
    'love',
    'nervousness',
    'optimism',
    'pride',
    'realization',
    'relief',
    'remorse',
    'sadness',
    'surprise',
    'neutral',
];

const OPTION_NO_FALLBACK = '#none';
const OPTION_EMOJI_FALLBACK = '#emoji';
const RESET_SPRITE_LABEL = '#reset';


/** @enum {number} */
const EXPRESSION_API = {
    local: 0,
    extras: 1,
    llm: 2,
    webllm: 3,
    none: 99,
};

/** @enum {string} */
const PROMPT_TYPE = {
    raw: 'raw',
    full: 'full',
};

let expressionsList = null;
let lastCharacter = undefined;
let lastMessage = null;
/** @type {{[characterKey: string]: Expression[]}} */
let spriteCache = {};
let inApiCall = false;
let lastServerResponseTime = 0;

/** @type {{[characterName: string]: string}} */
export let lastExpression = {};

/**
 * Returns a placeholder image object for a given expression
 * @param {string} expression - The expression label
 * @param {boolean} [isCustom=false] - Whether the expression is custom
 * @returns {ExpressionImage} The placeholder image object
 */
function getPlaceholderImage(expression, isCustom = false) {
    return {
        expression: expression,
        isCustom: isCustom,
        title: 'No Image',
        type: 'failure',
        fileName: 'No-Image-Placeholder.svg',
        imageSrc: '/img/No-Image-Placeholder.svg',
    };
}

function isVisualNovelMode() {
    return Boolean(!isMobile() && power_user.waifuMode && getContext().groupId);
}

async function forceUpdateVisualNovelMode() {
    if (isVisualNovelMode()) {
        await updateVisualNovelMode();
    }
}

const updateVisualNovelModeDebounced = debounce(forceUpdateVisualNovelMode, debounce_timeout.quick);

async function updateVisualNovelMode(spriteFolderName, expression) {
    const vnContainer = $('#visual-novel-wrapper');

    await visualNovelRemoveInactive(vnContainer);

    const setSpritePromises = await visualNovelSetCharacterSprites(vnContainer, spriteFolderName, expression);

    // calculate layer indices based on recent messages
    await visualNovelUpdateLayers(vnContainer);

    await Promise.allSettled(setSpritePromises);

    // update again based on new sprites
    if (setSpritePromises.length > 0) {
        await visualNovelUpdateLayers(vnContainer);
    }
}

async function visualNovelRemoveInactive(container) {
    const context = getContext();
    const group = context.groups.find(x => x.id == context.groupId);
    const removeInactiveCharactersPromises = [];

    // remove inactive characters after 1 second
    container.find('.expression-holder').each((_, current) => {
        const promise = new Promise(resolve => {
            const element = $(current);
            const avatar = element.data('avatar');

            if (!group.members.includes(avatar) || group.disabled_members.includes(avatar)) {
                element.fadeOut(250, () => {
                    element.remove();
                    resolve();
                });
            } else {
                resolve();
            }
        });

        removeInactiveCharactersPromises.push(promise);
    });

    await Promise.allSettled(removeInactiveCharactersPromises);
}

/**
 * Sets the character sprites for visual novel mode based on the provided container, name, and expression.
 *
 * @param {JQuery<HTMLElement>} vnContainer - The container element where the sprites will be set
 * @param {string} spriteFolderName - The name of the sprite folder
 * @param {string} expression - The expression to set for the characters
 * @returns {Promise<Array>} - An array of promises that resolve when the sprites are set
 */
async function visualNovelSetCharacterSprites(vnContainer, spriteFolderName, expression) {
    const originalExpression = expression;
    const context = getContext();
    const group = context.groups.find(x => x.id == context.groupId);

    const setSpritePromises = [];

    for (const avatar of group.members) {
        // skip disabled characters
        const isDisabled = group.disabled_members.includes(avatar);
        if (isDisabled && hideMutedSprites) {
            continue;
        }

        const character = context.characters.find(x => x.avatar == avatar);
        if (!character) {
            continue;
        }

        const expressionImage = vnContainer.find(`.expression-holder[data-avatar="${avatar}"]`);
        /** @type {JQuery<HTMLElement>} */
        let img;

        const memberSpriteFolderName = getSpriteFolderName({ original_avatar: character.avatar }, character.name);

        // download images if not downloaded yet
        if (spriteCache[memberSpriteFolderName] === undefined) {
            spriteCache[memberSpriteFolderName] = await getSpritesList(memberSpriteFolderName);
        }

        const prevExpressionSrc = expressionImage.find('img').attr('src') || null;

        if (!originalExpression && Array.isArray(spriteCache[memberSpriteFolderName]) && spriteCache[memberSpriteFolderName].length > 0) {
            expression = await getLastMessageSprite(avatar);
        }

        const spriteFile = chooseSpriteForExpression(memberSpriteFolderName, expression, { prevExpressionSrc: prevExpressionSrc });
        if (expressionImage.length) {
            if (!spriteFolderName || spriteFolderName == memberSpriteFolderName) {
                await validateImages(memberSpriteFolderName, true);
                setExpressionOverrideHtml(true); // <= force clear expression override input
                const path = spriteFile?.imageSrc || '';
                img = expressionImage.find('img');
                await setImage(img, path);
            }
            expressionImage.toggleClass('hidden', !spriteFile);
        } else {
            const template = $('#expression-holder').clone();
            template.attr('id', `expression-${avatar}`);
            template.attr('data-avatar', avatar);
            template.find('.drag-grabber').attr('id', `expression-${avatar}header`);
            $('#visual-novel-wrapper').append(template);
            dragElement($(template[0]));
            template.toggleClass('hidden', !spriteFile);
            img = template.find('img');
            await setImage(img, spriteFile?.imageSrc || '');
            const fadeInPromise = new Promise(resolve => {
                template.fadeIn(250, () => resolve());
            });
            setSpritePromises.push(fadeInPromise);
        }

        if (!img) {
            continue;
        }

        img.attr('data-sprite-folder-name', spriteFolderName);
        img.attr('data-expression', expression);
        img.attr('data-sprite-filename', spriteFile?.fileName || null);
        img.attr('title', expression);

        if (spriteFile) console.info(`Expression set for group member ${character.name}`, { expression: spriteFile.expression, file: spriteFile.fileName });
        else if (expressionImage.length) console.info(`Expression unset for group member ${character.name} - No sprite found`, { expression: expression });
        else console.info(`Expression not available for group member ${character.name}`, { expression: expression });
    }

    return setSpritePromises;
}

/**
 * Classifies the text of the latest message and returns the expression label.
 * @param {string} avatar - The avatar of the character to get the last message for
 * @returns {Promise<string>} - The expression label
 */
async function getLastMessageSprite(avatar) {
    const context = getContext();
    const lastMessage = context.chat.slice().reverse().find(x => x.original_avatar == avatar || (x.force_avatar && x.force_avatar.includes(encodeURIComponent(avatar))));

    if (lastMessage) {
        const text = lastMessage.mes || '';
        return await getExpressionLabel(text);
    }

    return null;
}

export async function visualNovelUpdateLayers(container) {
    const context = getContext();
    const group = context.groups.find(x => x.id == context.groupId);
    const recentMessages = context.chat.map(x => x.original_avatar).filter(x => x).reverse().filter(onlyUnique);
    const filteredMembers = group.members.filter(x => !group.disabled_members.includes(x));
    const layerIndices = filteredMembers.slice().sort((a, b) => {
        const aRecentIndex = recentMessages.indexOf(a);
        const bRecentIndex = recentMessages.indexOf(b);
        const aFilteredIndex = filteredMembers.indexOf(a);
        const bFilteredIndex = filteredMembers.indexOf(b);

        if (aRecentIndex !== -1 && bRecentIndex !== -1) {
            return bRecentIndex - aRecentIndex;
        } else if (aRecentIndex !== -1) {
            return 1;
        } else if (bRecentIndex !== -1) {
            return -1;
        } else {
            return aFilteredIndex - bFilteredIndex;
        }
    });

    const setLayerIndicesPromises = [];

    const sortFunction = (a, b) => {
        const avatarA = $(a).data('avatar');
        const avatarB = $(b).data('avatar');
        const indexA = filteredMembers.indexOf(avatarA);
        const indexB = filteredMembers.indexOf(avatarB);
        return indexA - indexB;
    };

    const containerWidth = container.width();
    const pivotalPoint = containerWidth * 0.5;

    let images = Array.from($('#visual-novel-wrapper .expression-holder')).sort(sortFunction);
    let imagesWidth = [];

    for (const image of images) {
        if (image instanceof HTMLImageElement && !image.complete) {
            await new Promise(resolve => image.addEventListener('load', resolve, { once: true }));
        }
    }

    images.forEach(image => {
        imagesWidth.push($(image).width());
    });

    let totalWidth = imagesWidth.reduce((a, b) => a + b, 0);
    let currentPosition = pivotalPoint - (totalWidth / 2);

    if (totalWidth > containerWidth) {
        let totalOverlap = totalWidth - containerWidth;
        let totalWidthWithoutWidest = imagesWidth.reduce((a, b) => a + b, 0) - Math.max(...imagesWidth);
        let overlaps = imagesWidth.map(width => (width / totalWidthWithoutWidest) * totalOverlap);
        imagesWidth = imagesWidth.map((width, index) => width - overlaps[index]);
        currentPosition = 0; // Reset the initial position to 0
    }

    images.forEach((current, index) => {
        const element = $(current);
        const elementID = element.attr('id');

        // skip repositioning of dragged elements
        if (element.data('dragged')
            || (power_user.movingUIState[elementID]
                && (typeof power_user.movingUIState[elementID] === 'object')
                && Object.keys(power_user.movingUIState[elementID]).length > 0)) {
            loadMovingUIState();
            //currentPosition += imagesWidth[index];
            return;
        }

        const avatar = element.data('avatar');
        const layerIndex = layerIndices.indexOf(avatar);
        element.css('z-index', layerIndex);
        element.show();

        const promise = new Promise(resolve => {
            if (power_user.reduced_motion) {
                element.css('left', currentPosition + 'px');
                requestAnimationFrame(() => resolve());
            }
            else {
                element.animate({ left: currentPosition + 'px' }, 500, () => {
                    resolve();
                });
            }
        });

        currentPosition += imagesWidth[index];

        setLayerIndicesPromises.push(promise);
    });

    await Promise.allSettled(setLayerIndicesPromises);
}

/**
 * Sets the expression for the given character image.
 * @param {JQuery<HTMLElement>} img - The image element to set the image on
 * @param {string} path - The path to the image
 * @returns {Promise<void>} - A promise that resolves when the image is set
 */
async function setImage(img, path) {
    // Cohee: If something goes wrong, uncomment this to return to the old behavior
    /*
    img.attr('src', path);
    img.removeClass('default');
    img.off('error');
    img.on('error', function () {
        console.debug('Error loading image', path);
        $(this).off('error');
        $(this).attr('src', '');
    });
    */

    return new Promise(resolve => {
        const prevExpressionSrc = img.attr('src');
        const expressionClone = img.clone();
        const originalId = img.data('filename');

        //only swap expressions when necessary
        if (prevExpressionSrc !== path && !img.hasClass('expression-animating')) {
            //clone expression
            expressionClone.addClass('expression-clone');
            //make invisible and remove id to prevent double ids
            //must be made invisible to start because they share the same Z-index
            expressionClone.data('filename', '').css({ opacity: 0 });
            //add new sprite path to clone src
            expressionClone.attr('src', path);
            //add invisible clone to html
            expressionClone.appendTo(img.parent());

            const duration = 200;

            //add animation flags to both images
            //to prevent multiple expression changes happening simultaneously
            img.addClass('expression-animating');

            // Set the parent container's min width and height before running the transition
            const imgWidth = img.width();
            const imgHeight = img.height();
            const expressionHolder = img.parent();
            expressionHolder.css('min-width', imgWidth > 100 ? imgWidth : 100);
            expressionHolder.css('min-height', imgHeight > 100 ? imgHeight : 100);

            //position absolute prevent the original from jumping around during transition
            img.css('position', 'absolute').width(imgWidth).height(imgHeight);
            expressionClone.addClass('expression-animating');
            //fade the clone in
            expressionClone.css({
                opacity: 0,
            }).animate({
                opacity: 1,
            }, duration)
                //when finshed fading in clone, fade out the original
                .promise().done(function () {
                    img.animate({
                        opacity: 0,
                    }, duration);
                    //remove old expression
                    img.remove();
                    //replace ID so it becomes the new 'original' expression for next change
                    expressionClone.data('filename', originalId);
                    expressionClone.removeClass('expression-animating');

                    // Reset the expression holder min height and width
                    expressionHolder.css('min-width', 100);
                    expressionHolder.css('min-height', 100);

                    if (expressionClone.prop('complete')) {
                        resolve();
                    } else {
                        expressionClone.one('load', () => resolve());
                    }
                });

            expressionClone.removeClass('expression-clone');

            expressionClone.removeClass('default');
            expressionClone.off('error');
            expressionClone.on('error', function () {
                console.debug('Expression image error', path);
                $(this).attr('src', '');
                $(this).off('error');
                resolve();
            });
        } else {
            resolve();
        }
    });
}

async function moduleWorker({ newChat = false } = {}) {
    const context = getContext();

    // non-characters not supported
    if (!context.groupId && context.characterId === undefined) {
        removeExpression();
        return;
    }

    const vnMode = isVisualNovelMode();
    const vnWrapperVisible = $('#visual-novel-wrapper').is(':visible');

    if (vnMode) {
        $('#expression-wrapper').hide();
        $('#visual-novel-wrapper').show();
    } else {
        $('#expression-wrapper').show();
        $('#visual-novel-wrapper').hide();
    }

    const vnStateChanged = vnMode !== vnWrapperVisible;

    if (vnStateChanged) {
        lastMessage = null;
        $('#visual-novel-wrapper').empty();
        $('#expression-holder').css({ top: '', left: '', right: '', bottom: '', height: '', width: '', margin: '' });
    }

    const currentLastMessage = getLastCharacterMessage();
    let spriteFolderName = getSpriteFolderName(currentLastMessage, currentLastMessage.name);

    // character has no expressions or it is not loaded
    if (Object.keys(spriteCache).length === 0) {
        await validateImages(spriteFolderName);
        lastCharacter = context.groupId || context.characterId;
    }

    const offlineMode = $('.expression_settings .offline_mode');
    if (!modules.includes('classify') && extension_settings.expressions.api == EXPRESSION_API.extras) {
        $('#open_chat_expressions').show();
        $('#no_chat_expressions').hide();
        offlineMode.css('display', 'block');
        lastCharacter = context.groupId || context.characterId;

        if (context.groupId) {
            await validateImages(spriteFolderName, true);
            await forceUpdateVisualNovelMode();
        }

        return;
    }
    else {
        // force reload expressions list on connect to API
        if (offlineMode.is(':visible')) {
            expressionsList = null;
            spriteCache = {};
            expressionsList = await getExpressionsList();
            await validateImages(spriteFolderName, true);
            await forceUpdateVisualNovelMode();
        }

        if (context.groupId && !Array.isArray(spriteCache[spriteFolderName])) {
            await validateImages(spriteFolderName, true);
            await forceUpdateVisualNovelMode();
        }

        offlineMode.css('display', 'none');
    }

    if (context.groupId && vnMode && newChat) {
        await forceUpdateVisualNovelMode();
    }

    // Don't bother classifying if current char has no sprites and no default expressions are enabled
    if ((!Array.isArray(spriteCache[spriteFolderName]) || spriteCache[spriteFolderName].length === 0) && !extension_settings.expressions.showDefault) {
        return;
    }

    const lastMessageChanged = !((lastCharacter === context.characterId || lastCharacter === context.groupId) && lastMessage === currentLastMessage.mes);

    // check if last message changed
    if (!lastMessageChanged) {
        return;
    }

    // If using LLM api then check if streamingProcessor is finished to avoid sending multiple requests to the API
    if (extension_settings.expressions.api === EXPRESSION_API.llm && context.streamingProcessor && !context.streamingProcessor.isFinished) {
        return;
    }

    // API is busy
    if (inApiCall) {
        console.debug('Classification API is busy');
        return;
    }

    // Throttle classification requests during streaming
    if (!context.groupId && context.streamingProcessor && !context.streamingProcessor.isFinished) {
        const now = Date.now();
        const timeSinceLastServerResponse = now - lastServerResponseTime;

        if (timeSinceLastServerResponse < STREAMING_UPDATE_INTERVAL) {
            console.log('Streaming in progress: throttling expression update. Next update at ' + new Date(lastServerResponseTime + STREAMING_UPDATE_INTERVAL));
            return;
        }
    }

    try {
        inApiCall = true;
        let expression = await getExpressionLabel(currentLastMessage.mes);

        // If we're not already overriding the folder name, account for group chats.
        if (spriteFolderName === currentLastMessage.name && !context.groupId) {
            spriteFolderName = context.name2;
        }

        const force = !!context.groupId;

        // Character won't be angry on you for swiping
        if (currentLastMessage.mes == '...' && expressionsList.includes(extension_settings.expressions.fallback_expression)) {
            expression = extension_settings.expressions.fallback_expression;
        }

        await sendExpressionCall(spriteFolderName, expression, { force: force, vnMode: vnMode });
    }
    catch (error) {
        console.log(error);
    }
    finally {
        inApiCall = false;
        lastCharacter = context.groupId || context.characterId;
        lastMessage = currentLastMessage.mes;
        lastServerResponseTime = Date.now();
    }
}

function getSpriteFolderName(characterMessage = null, characterName = null) {
    const context = getContext();
    let spriteFolderName = characterName ?? context.name2;
    const message = characterMessage ?? getLastCharacterMessage();
    const avatarFileName = getFolderNameByMessage(message);
    const expressionOverride = extension_settings.expressionOverrides.find(e => e.name == avatarFileName);

    if (expressionOverride && expressionOverride.path) {
        spriteFolderName = expressionOverride.path;
    }

    return spriteFolderName;
}

function getFolderNameByMessage(message) {
    const context = getContext();
    let avatarPath = '';

    if (context.groupId) {
        avatarPath = message.original_avatar || context.characters.find(x => message.force_avatar && message.force_avatar.includes(encodeURIComponent(x.avatar)))?.avatar;
    }
    else if (context.characterId !== undefined) {
        avatarPath = getCharaFilename();
    }

    if (!avatarPath) {
        return '';
    }

    const folderName = avatarPath.replace(/\.[^/.]+$/, '');
    return folderName;
}

/**
 * Update the expression for the given character.
 *
 * @param {string} spriteFolderName The character name, optionally with a sprite folder override, e.g. "folder/expression".
 * @param {string} expression The expression label, e.g. "amusement", "joy", etc.
 * @param {Object} [options] Additional options
 * @param {boolean} [options.force=false] If true, the expression will be sent even if it is the same as the current expression.
 * @param {boolean} [options.vnMode=null] If true, the expression will be sent in Visual Novel mode. If null, it will be determined by the current chat mode.
 * @param {string?} [options.overrideSpriteFile=null] - Set if a specific sprite file should be used. Must be sprite file name.
 */
export async function sendExpressionCall(spriteFolderName, expression, { force = false, vnMode = null, overrideSpriteFile = null } = {}) {
    lastExpression[spriteFolderName.split('/')[0]] = expression;
    if (vnMode === null) {
        vnMode = isVisualNovelMode();
    }

    if (vnMode) {
        await updateVisualNovelMode(spriteFolderName, expression);
    } else {
        setExpression(spriteFolderName, expression, { force: force, overrideSpriteFile: overrideSpriteFile });
    }
}

async function setSpriteFolderCommand(_, folder) {
    if (!folder) {
        console.log('Clearing sprite set');
        folder = '';
    }

    if (folder.startsWith('/') || folder.startsWith('\\')) {
        const currentLastMessage = getLastCharacterMessage();
        folder = folder.slice(1);
        folder = `${currentLastMessage.name}/${folder}`;
    }

    $('#expression_override').val(folder.trim());
    onClickExpressionOverrideButton();

    // No need to resend the expression, the folder override will automatically update the currently displayed one.
    return '';
}

async function classifyCallback(/** @type {{api: string?, filter: string?, prompt: string?}} */ { api = null, filter = null, prompt = null }, text) {
    if (!text) {
        toastr.error('No text provided');
        return '';
    }
    if (api && !Object.keys(EXPRESSION_API).includes(api)) {
        toastr.error('Invalid API provided');
        return '';
    }

    const expressionApi = EXPRESSION_API[api] || extension_settings.expressions.api;
    const filterAvailable = !isFalseBoolean(filter);

    if (expressionApi === EXPRESSION_API.none) {
        toastr.warning('No classifier API selected');
        return '';
    }

    if (!modules.includes('classify') && expressionApi == EXPRESSION_API.extras) {
        toastr.warning('Text classification is disabled or not available');
        return '';
    }

    const label = await getExpressionLabel(text, expressionApi, { filterAvailable: filterAvailable, customPrompt: prompt });
    console.debug(`Classification result for "${text}": ${label}`);
    return label;
}

/** @type {(args: {type: 'expression' | 'sprite'}, searchTerm: string) => Promise<string>} */
async function setSpriteSlashCommand({ type }, searchTerm) {
    type ??= 'expression';
    searchTerm = searchTerm.trim().toLowerCase();
    if (!searchTerm) {
        toastr.error(t`No expression or sprite name provided`, t`Set Sprite`);
        return '';
    }

    const currentLastMessage = selected_group ? getLastCharacterMessage() : null;
    const spriteFolderName = getSpriteFolderName(currentLastMessage, currentLastMessage?.name);

    let label = searchTerm;

    /** @type {string?} */
    let spriteFile = null;

    await validateImages(spriteFolderName);

    // Handle reset as a special term and just reset the sprite via expression call
    if (searchTerm === RESET_SPRITE_LABEL) {
        await sendExpressionCall(spriteFolderName, label, { force: true });
        return lastExpression[spriteFolderName] ?? '';
    }

    switch (type) {
        case 'expression': {
            // Fuzzy search for expression
            const existingExpressions = getCachedExpressions().map(x => ({ label: x }));
            const results = performFuzzySearch('expression-expressions', existingExpressions, [
                { name: 'label', weight: 1 },
            ], searchTerm);
            const matchedExpression = results[0]?.item;
            if (!matchedExpression) {
                toastr.warning(t`No expression found for search term ${searchTerm}`, t`Set Sprite`);
                return '';
            }

            label = matchedExpression.label;
            break;
        }
        case 'sprite': {
            // Fuzzy search for sprite file
            const sprites = spriteCache[spriteFolderName].map(x => x.files).flat();
            const results = performFuzzySearch('expression-expressions', sprites, [
                { name: 'title', weight: 1 },
                { name: 'fileName', weight: 1 },
            ], searchTerm);
            const matchedSprite = results[0]?.item;
            if (!matchedSprite) {
                toastr.warning(t`No sprite file found for search term ${searchTerm}`, t`Set Sprite`);
                return '';
            }

            label = matchedSprite.expression;
            spriteFile = matchedSprite.fileName;
            break;
        }
        default: throw Error('Invalid sprite set type: ' + type);
    }

    await sendExpressionCall(spriteFolderName, label, { force: true, overrideSpriteFile: spriteFile });

    return label;
}

/**
 * Returns the sprite folder name (including override) for a character.
 * @param {object} char Character object
 * @param {string} char.avatar Avatar filename with extension
 * @returns {string} Sprite folder name
 * @throws {Error} If character not found or avatar not set
 */
function spriteFolderNameFromCharacter(char) {
    const avatarFileName = char.avatar.replace(/\.[^/.]+$/, '');
    const expressionOverride = extension_settings.expressionOverrides.find(e => e.name === avatarFileName);
    return expressionOverride?.path ? expressionOverride.path : avatarFileName;
}

/**
 * Generates a unique sprite name by appending an index to the given expression. *
 * @param {string} expression - The base expression to be used as the prefix for the sprite name.
 * @param {ExpressionImage[]} existingFiles - An array of existing file objects, each containing a fileName property.
 * @returns {string} - A unique sprite name with the format "expression-index".
 */
function generateUniqueSpriteName(expression, existingFiles) {
    let index = existingFiles.length;
    let newSpriteName;
    do {
        newSpriteName = `${expression}-${index++}`;
    } while (existingFiles.some(file => withoutExtension(file.fileName) === newSpriteName));
    return newSpriteName;
}

/**
 * Slash command callback for /uploadsprite
 *
 * label= is required
 * if name= is provided, it will be used as a findChar lookup
 * if name= is not provided, the last character's name will be used
 * if folder= is a full path, it will be used as the folder
 * if folder= is a partial path, it will be appended to the character's name
 * if folder= is not provided, the character's override folder will be used, if set
 *
 * @param {object} args
 * @param {string} args.name Character name or avatar key, passed through findChar
 * @param {string} args.label Expression label
 * @param {string} [args.folder=null] Optional sprite folder path, processed using backslash rules
 * @param {string?} [args.spriteName=null] Optional sprite name
 * @param {string} imageUrl Image URI to fetch and upload
 * @returns {Promise<string>} the sprite name
 */
async function uploadSpriteCommand({ name, label, folder = null, spriteName = null }, imageUrl) {
    if (!imageUrl) throw new Error('Image URL is required');
    if (!label || typeof label !== 'string') {
        toastr.error(t`Expression label is required`, t`Error Uploading Sprite`);
        return '';
    }

    label = label.replace(/[^a-z]/gi, '').toLowerCase().trim();
    if (!label) {
        toastr.error(t`Expression label must contain at least one letter`, t`Error Uploading Sprite`);
        return '';
    }

    spriteName = spriteName || label;
    if (!validateExpressionSpriteName(label, spriteName)) {
        toastr.error(t`Invalid sprite name. Must follow the naming pattern for expression sprites.`, t`Error Uploading Sprite`);
        return '';
    }

    name = name || getLastCharacterMessage().original_avatar || getLastCharacterMessage().name;
    const char = findChar({ name });

    if (!folder) {
        folder = spriteFolderNameFromCharacter(char);
    } else if (folder.startsWith('/') || folder.startsWith('\\')) {
        const subfolder = folder.slice(1);
        folder = `${char.name}/${subfolder}`;
    }

    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'image.png', { type: 'image/png' });

        const formData = new FormData();
        formData.append('name', folder); // this is the folder or character name
        formData.append('label', label); // this is the expression label
        formData.append('avatar', file); // this is the image file
        formData.append('spriteName', spriteName); // this is a redundant comment

        await handleFileUpload('/api/sprites/upload', formData);
        console.debug(`[${MODULE_NAME}] Upload of ${imageUrl} completed for ${name} with label ${label}`);
    } catch (error) {
        console.error(`[${MODULE_NAME}] Error uploading file:`, error);
        throw error;
    }

    return spriteName;
}

/**
 * Processes the classification text to reduce the amount of text sent to the API.
 * Quotes and asterisks are to be removed. If the text is less than 300 characters, it is returned as is.
 * If the text is more than 300 characters, the first and last 150 characters are returned.
 * The result is trimmed to the end of sentence.
 * @param {string} text The text to process.
 * @returns {string}
 */
function sampleClassifyText(text) {
    if (!text) {
        return text;
    }

    // Replace macros, remove asterisks and quotes
    let result = substituteParams(text).replace(/[*"]/g, '');

    // If using LLM api there is no need to check length of characters
    if (extension_settings.expressions.api === EXPRESSION_API.llm) {
        return result.trim();
    }

    const SAMPLE_THRESHOLD = 500;
    const HALF_SAMPLE_THRESHOLD = SAMPLE_THRESHOLD / 2;

    if (text.length < SAMPLE_THRESHOLD) {
        result = trimToEndSentence(result);
    } else {
        result = trimToEndSentence(result.slice(0, HALF_SAMPLE_THRESHOLD)) + ' ' + trimToStartSentence(result.slice(-HALF_SAMPLE_THRESHOLD));
    }

    return result.trim();
}

/**
 * Gets the classification prompt for the LLM API.
 * @param {string[]} labels A list of labels to search for.
 * @returns {Promise<string>} Prompt for the LLM API.
 */
async function getLlmPrompt(labels) {
    const labelsString = labels.map(x => `"${x}"`).join(', ');
    const prompt = substituteParamsExtended(String(extension_settings.expressions.llmPrompt), { labels: labelsString });
    return prompt;
}

/**
 * Parses the emotion response from the LLM API.
 * @param {string} emotionResponse The response from the LLM API.
 * @param {string[]} labels A list of labels to search for.
 * @returns {string} The parsed emotion or the fallback expression.
 */
function parseLlmResponse(emotionResponse, labels) {
    try {
        const parsedEmotion = JSON.parse(emotionResponse);
        const response = parsedEmotion?.emotion?.trim()?.toLowerCase();

        if (!response || !labels.includes(response)) {
            console.debug(`Parsed emotion response: ${response} not in labels: ${labels}`);
            throw new Error('Emotion not in labels');
        }

        return response;
    } catch {
        // Clean possible reasoning from response
        emotionResponse = removeReasoningFromString(emotionResponse);

        const fuse = new Fuse(labels, { includeScore: true });
        console.debug('Using fuzzy search in labels:', labels);
        const result = fuse.search(emotionResponse);
        if (result.length > 0) {
            console.debug(`fuzzy search found: ${result[0].item} as closest for the LLM response:`, emotionResponse);
            return result[0].item;
        }
        const lowerCaseResponse = String(emotionResponse || '').toLowerCase();
        for (const label of labels) {
            if (lowerCaseResponse.includes(label.toLowerCase())) {
                console.debug(`Found label ${label} in the LLM response:`, emotionResponse);
                return label;
            }
        }
    }

    throw new Error('Could not parse emotion response ' + emotionResponse);
}

/**
 * Gets the JSON schema for the LLM API.
 * @param {string[]} emotions A list of emotions to search for.
 * @returns {object} The JSON schema for the LLM API.
 */
function getJsonSchema(emotions) {
    return {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
            emotion: {
                type: 'string',
                enum: emotions,
            },
        },
        required: [
            'emotion',
        ],
        additionalProperties: false,
    };
}

function onTextGenSettingsReady(args) {
    // Only call if inside an API call
    if (inApiCall && extension_settings.expressions.api === EXPRESSION_API.llm && isJsonSchemaSupported()) {
        const emotions = DEFAULT_EXPRESSIONS;
        Object.assign(args, {
            top_k: 1,
            stop: [],
            stopping_strings: [],
            custom_token_bans: [],
            json_schema: getJsonSchema(emotions),
        });
    }
}

/**
 * Retrieves the label of an expression via classification based on the provided text.
 * Optionally allows to override the expressions API being used.
 * @param {string} text - The text to classify and retrieve the expression label for.
 * @param {EXPRESSION_API} [expressionsApi=extension_settings.expressions.api] - The expressions API to use for classification.
 * @param {object} [options={}] - Optional arguments.
 * @param {boolean?} [options.filterAvailable=null] - Whether to filter available expressions. If not specified, uses the extension setting.
 * @param {string?} [options.customPrompt=null] - The custom prompt to use for classification.
 * @returns {Promise<string?>} - The label of the expression.
 */
export async function getExpressionLabel(text, expressionsApi = extension_settings.expressions.api, { filterAvailable = null, customPrompt = null } = {}) {
    // Return if text is undefined, saving a costly fetch request
    if ((!modules.includes('classify') && expressionsApi == EXPRESSION_API.extras) || !text) {
        return extension_settings.expressions.fallback_expression;
    }

    if (extension_settings.expressions.translate && typeof globalThis.translate === 'function') {
        text = await globalThis.translate(text, 'en');
    }

    text = sampleClassifyText(text);

    filterAvailable ??= extension_settings.expressions.filterAvailable;
    if (filterAvailable && ![EXPRESSION_API.llm, EXPRESSION_API.webllm].includes(expressionsApi)) {
        console.debug('Filter available is only supported for LLM and WebLLM expressions');
    }

    try {
        switch (expressionsApi) {
            // Local BERT pipeline
            case EXPRESSION_API.local: {
                const localResult = await fetch('/api/extra/classify', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ text: text }),
                });

                if (localResult.ok) {
                    const data = await localResult.json();
                    return data.classification[0].label;
                }
            } break;
            // Using LLM
            case EXPRESSION_API.llm: {
                try {
                    await waitUntilCondition(() => online_status !== 'no_connection', 3000, 250);
                } catch (error) {
                    console.warn('No LLM connection. Using fallback expression', error);
                    return extension_settings.expressions.fallback_expression;
                }

                const expressionsList = await getExpressionsList({ filterAvailable: filterAvailable });
                const prompt = substituteParamsExtended(customPrompt, { labels: expressionsList }) || await getLlmPrompt(expressionsList);
                eventSource.once(event_types.TEXT_COMPLETION_SETTINGS_READY, onTextGenSettingsReady);

                let emotionResponse;
                try {
                    inApiCall = true;
                    switch (extension_settings.expressions.promptType) {
                        case PROMPT_TYPE.raw:
                            emotionResponse = await generateRaw(text, main_api, false, false, prompt);
                            break;
                        case PROMPT_TYPE.full:
                            emotionResponse = await generateQuietPrompt(prompt, false, false);
                            break;
                    }
                } finally {
                    inApiCall = false;
                }
                return parseLlmResponse(emotionResponse, expressionsList);
            }
            // Using WebLLM
            case EXPRESSION_API.webllm: {
                if (!isWebLlmSupported()) {
                    console.warn('WebLLM is not supported. Using fallback expression');
                    return extension_settings.expressions.fallback_expression;
                }

                const expressionsList = await getExpressionsList({ filterAvailable: filterAvailable });
                const prompt = substituteParamsExtended(customPrompt, { labels: expressionsList }) || await getLlmPrompt(expressionsList);
                const messages = [
                    { role: 'user', content: text + '\n\n' + prompt },
                ];

                const emotionResponse = await generateWebLlmChatPrompt(messages);
                return parseLlmResponse(emotionResponse, expressionsList);
            }
            // Extras
            case EXPRESSION_API.extras: {
                const url = new URL(getApiUrl());
                url.pathname = '/api/classify';

                const extrasResult = await doExtrasFetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Bypass-Tunnel-Reminder': 'bypass',
                    },
                    body: JSON.stringify({ text: text }),
                });

                if (extrasResult.ok) {
                    const data = await extrasResult.json();
                    return data.classification[0].label;
                }
            } break;
            // None
            case EXPRESSION_API.none: {
                // Return empty, the fallback expression will be used
                return '';
            }
            default: {
                toastr.error('Invalid API selected');
                return '';
            }
        }
    } catch (error) {
        toastr.error('Could not classify expression. Check the console or your backend for more information.');
        console.error(error);
        return extension_settings.expressions.fallback_expression;
    }
}

function getLastCharacterMessage() {
    const context = getContext();
    const reversedChat = context.chat.slice().reverse();

    for (let mes of reversedChat) {
        if (mes.is_user || mes.is_system || mes.extra?.type === system_message_types.NARRATOR) {
            continue;
        }

        return { mes: mes.mes, name: mes.name, original_avatar: mes.original_avatar, force_avatar: mes.force_avatar };
    }

    return { mes: '', name: null, original_avatar: null, force_avatar: null };
}

function removeExpression() {
    lastMessage = null;
    $('img.expression').off('error');
    $('img.expression').prop('src', '');
    $('img.expression').removeClass('default');
    $('#open_chat_expressions').hide();
    $('#no_chat_expressions').show();
}

/**
 * Validate a character's sprites, and redraw the sprites list if not done before or forced to redraw.
 * @param {string} spriteFolderName - The character sprite folder to validate
 * @param {boolean} [forceRedrawCached=false] - Whether to force redrawing the sprites list even if it's already been drawn before
 */
async function validateImages(spriteFolderName, forceRedrawCached = false) {
    if (!spriteFolderName) {
        return;
    }

    const labels = await getExpressionsList();

    if (spriteCache[spriteFolderName]) {
        if (forceRedrawCached && $('#image_list').data('name') !== spriteFolderName) {
            console.debug('force redrawing character sprites list');
            await drawSpritesList(spriteFolderName, labels, spriteCache[spriteFolderName]);
        }

        return;
    }

    const sprites = await getSpritesList(spriteFolderName);
    let validExpressions = await drawSpritesList(spriteFolderName, labels, sprites);
    spriteCache[spriteFolderName] = validExpressions;
}

/**
 * Takes a given sprite as returned from the server, and enriches it with additional data for display/sorting
 * @param {{ path: string, label: string }} sprite
 * @returns {ExpressionImage}
 */
function getExpressionImageData(sprite) {
    const fileName = sprite.path.split('/').pop().split('?')[0];
    const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, '');
    return {
        expression: sprite.label,
        fileName: fileName,
        title: fileNameWithoutExtension,
        imageSrc: sprite.path,
        type: 'success',
        isCustom: extension_settings.expressions.custom?.includes(sprite.label),
    };
}

/**
 * Populate the character expression list with sprites for the given character.
 * @param {string} spriteFolderName - The name of the character to populate the list for
 * @param {string[]} labels - An array of expression labels that are valid
 * @param {Expression[]} sprites - An array of sprites
 * @returns {Promise<Expression[]>} An array of valid expression labels
 */
async function drawSpritesList(spriteFolderName, labels, sprites) {
    /** @type {Expression[]} */
    let validExpressions = [];

    $('#no_chat_expressions').hide();
    $('#open_chat_expressions').show();
    $('#image_list').empty();
    $('#image_list').data('name', spriteFolderName);
    $('#image_list_header_name').text(spriteFolderName);

    if (!Array.isArray(labels)) {
        return [];
    }

    for (const expression of labels.sort()) {
        const isCustom = extension_settings.expressions.custom?.includes(expression);
        const images = sprites
            .filter(s => s.label === expression)
            .map(s => s.files)
            .flat();

        if (images.length === 0) {
            const listItem = await getListItem(expression, {
                isCustom,
                images: [getPlaceholderImage(expression, isCustom)],
            });
            $('#image_list').append(listItem);
            continue;
        }

        validExpressions.push({ label: expression, files: images });

        // Render main = first file, additional = rest
        let listItem = await getListItem(expression, {
            isCustom,
            images,
        });
        $('#image_list').append(listItem);
    }
    return validExpressions;
}

/**
 * Renders a list item template for the expressions list.
 * @param {string} expression Expression name
 * @param {object} args Arguments object
 * @param {ExpressionImage[]} [args.images] Array of image objects
 * @param {boolean} [args.isCustom=false] If expression is added by user
 * @returns {Promise<string>} Rendered list item template
 */
async function getListItem(expression, { images, isCustom = false } = {}) {
    return renderExtensionTemplateAsync(MODULE_NAME, 'list-item', { expression, images, isCustom: isCustom ?? false });
}

/**
 * Fetches and processes the list of sprites for a given character name.
 * Retrieves sprite data from the server and organizes it into labeled groups.
 *
 * @param {string} name - The character name to fetch sprites for
 * @returns {Promise<Expression[]>} A promise that resolves to an array of grouped expression objects, each containing a label and associated image data
 */

async function getSpritesList(name) {
    console.debug('getting sprites list');

    try {
        const result = await fetch(`/api/sprites/get?name=${encodeURIComponent(name)}`);
        /** @type {{ label: string, path: string }[]} */
        let sprites = result.ok ? (await result.json()) : [];

        /** @type {Expression[]} */
        const grouped = sprites.reduce((acc, sprite) => {
            const imageData = getExpressionImageData(sprite);
            let existingExpression = acc.find(exp => exp.label === sprite.label);
            if (existingExpression) {
                existingExpression.files.push(imageData);
            } else {
                acc.push({ label: sprite.label, files: [imageData] });
            }

            return acc;
        }, []);

        // Sort the sprites for each expression alphabetically, but keep the main expression file at the front
        for (const expression of grouped) {
            expression.files.sort((a, b) => {
                if (a.title === expression.label) return -1;
                if (b.title === expression.label) return 1;
                return a.title.localeCompare(b.title);
            });

            // Mark all besides the first sprite as 'additional'
            for (let i = 1; i < expression.files.length; i++) {
                expression.files[i].type = 'additional';
            }
        }

        return grouped;
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

async function renderAdditionalExpressionSettings() {
    renderCustomExpressions();
    await renderFallbackExpressionPicker();
}

function renderCustomExpressions() {
    if (!Array.isArray(extension_settings.expressions.custom)) {
        extension_settings.expressions.custom = [];
    }

    const customExpressions = extension_settings.expressions.custom.sort((a, b) => a.localeCompare(b));
    $('#expression_custom').empty();

    for (const expression of customExpressions) {
        const option = document.createElement('option');
        option.value = expression;
        option.text = expression;
        $('#expression_custom').append(option);
    }

    if (customExpressions.length === 0) {
        $('#expression_custom').append('<option value="" disabled selected>[ No custom expressions ]</option>');
    }
}

async function renderFallbackExpressionPicker() {
    const expressions = await getExpressionsList();

    const defaultPicker = $('#expression_fallback');
    defaultPicker.empty();


    addOption(OPTION_NO_FALLBACK, '[ No fallback ]', !extension_settings.expressions.fallback_expression);
    addOption(OPTION_EMOJI_FALLBACK, '[ Default emojis ]', !!extension_settings.expressions.showDefault);

    for (const expression of expressions) {
        addOption(expression, expression, expression == extension_settings.expressions.fallback_expression);
    }

    /** @type {(value: string, label: string, isSelected: boolean) => void} */
    function addOption(value, label, isSelected) {
        const option = document.createElement('option');
        option.value = value;
        option.text = label;
        option.selected = isSelected;
        defaultPicker.append(option);
    }
}

/**
 * Retrieves a unique list of cached expressions.
 * Combines the default expressions list with custom user-defined expressions.
 *
 * @returns {string[]} An array of unique expression labels
 */

function getCachedExpressions() {
    if (!Array.isArray(expressionsList)) {
        return [];
    }

    return [...expressionsList, ...extension_settings.expressions.custom].filter(onlyUnique);
}

export async function getExpressionsList({ filterAvailable = false } = {}) {
    // If there is no cached list, load and cache it
    if (!Array.isArray(expressionsList)) {
        expressionsList = await resolveExpressionsList();
    }

    const expressions = getCachedExpressions();

    // Filtering is only available for llm and webllm APIs
    if (!filterAvailable || ![EXPRESSION_API.llm, EXPRESSION_API.webllm].includes(extension_settings.expressions.api)) {
        return expressions;
    }

    // Get expressions with available sprites
    const currentLastMessage = selected_group ? getLastCharacterMessage() : null;
    const spriteFolderName = getSpriteFolderName(currentLastMessage, currentLastMessage?.name);

    return expressions.filter(label => {
        const expression = spriteCache[spriteFolderName]?.find(x => x.label === label);
        return (expression?.files.length ?? 0) > 0;
    });

    /**
     * Returns the list of expressions from the API or fallback in offline mode.
     * @returns {Promise<string[]>}
     */
    async function resolveExpressionsList() {
        // See if we can retrieve a specific expression list from the API
        try {
            // Check Extras api first, if enabled and that module active
            if (extension_settings.expressions.api == EXPRESSION_API.extras && modules.includes('classify')) {
                const url = new URL(getApiUrl());
                url.pathname = '/api/classify/labels';

                const apiResult = await doExtrasFetch(url, {
                    method: 'GET',
                    headers: { 'Bypass-Tunnel-Reminder': 'bypass' },
                });

                if (apiResult.ok) {

                    const data = await apiResult.json();
                    expressionsList = data.labels;
                    return expressionsList;
                }
            }

            // If running the local classify model (not using the LLM), we ask that one
            if (extension_settings.expressions.api == EXPRESSION_API.local) {
                const apiResult = await fetch('/api/extra/classify/labels', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                });

                if (apiResult.ok) {
                    const data = await apiResult.json();
                    expressionsList = data.labels;
                    return expressionsList;
                }
            }
        } catch (error) {
            console.log(error);
        }

        // If there was no specific list, or an error, just return the default expressions
        expressionsList = DEFAULT_EXPRESSIONS.slice();
        return expressionsList;
    }
}

/**
 * Selects a sprite from the given sprite folder for the given expression.
 *
 * If multiple sprites are allowed for the expression, it will randomly select one.
 * If the rerollIfSame option is enabled, it will only select a different sprite if the previous sprite was the same.
 * If the overrideSpriteFile option is set, it will look for the sprite with the given file name instead of randomly selecting one.
 *
 * @param {string} spriteFolderName - The name of the sprite folder
 * @param {string} expression - The expression to find the sprite for
 * @param {object} [options] - Options to select the sprite
 * @param {string} [options.prevExpressionSrc=null] - The source of the previous expression
 * @param {string} [options.overrideSpriteFile=null] - The file name of the sprite to select
 * @returns {ExpressionImage?} - The selected sprite
 */
function chooseSpriteForExpression(spriteFolderName, expression, { prevExpressionSrc = null, overrideSpriteFile = null } = {}) {
    if (!spriteCache[spriteFolderName]) return null;
    if (expression === RESET_SPRITE_LABEL) return null;

    // Search for sprites of that expression - or fallback expression sprites if enabled
    let sprite = spriteCache[spriteFolderName].find(x => x.label === expression);
    if (!(sprite?.files.length > 0) && extension_settings.expressions.fallback_expression) {
        sprite = spriteCache[spriteFolderName].find(x => x.label === extension_settings.expressions.fallback_expression);
        console.debug('Expression', expression, 'not found. Using fallback expression', extension_settings.expressions.fallback_expression);
    }
    if (!(sprite?.files.length > 0)) return null;

    let spriteFile = sprite.files[0];

    // If a specific sprite file should be set, we are looking it up here
    if (overrideSpriteFile) {
        const searched = sprite.files.find(x => x.fileName === overrideSpriteFile);
        if (searched) spriteFile = searched;
        else toastr.warning(t`Couldn't find sprite file ${overrideSpriteFile} for expression ${expression}.`, t`Sprite Not Found`);
    }
    // Else calculate next expression, if multiple are allowed
    else if (extension_settings.expressions.allowMultiple && sprite.files.length > 1) {
        let possibleFiles = sprite.files;
        if (extension_settings.expressions.rerollIfSame) {
            possibleFiles = possibleFiles.filter(x => !prevExpressionSrc || x.imageSrc !== prevExpressionSrc);
        }
        spriteFile = possibleFiles[Math.floor(Math.random() * possibleFiles.length)];
    }

    return spriteFile;

}

/**
 * Set the expression of a character.
 * @param {string} spriteFolderName - The name of the character (folder name - can also be a costume override)
 * @param {string} expression - The expression or sprite name to set
 * @param {Object} options - Optional parameters
 * @param {boolean} [options.force=false] - Whether to force the expression change even if Visual Novel mode is on
 * @param {string?} [options.overrideSpriteFile=null] - Set if a specific sprite file should be used. Must be sprite file name.
 * @returns {Promise<void>} A promise that resolves when the expression has been set.
 */
async function setExpression(spriteFolderName, expression, { force = false, overrideSpriteFile = null } = {}) {
    await validateImages(spriteFolderName);
    const img = $('img.expression');
    const prevExpressionSrc = img.attr('src');
    const expressionClone = img.clone();

    const spriteFile = chooseSpriteForExpression(spriteFolderName, expression, { prevExpressionSrc: prevExpressionSrc, overrideSpriteFile: overrideSpriteFile });
    if (spriteFile) {
        if (force && isVisualNovelMode()) {
            const context = getContext();
            const group = context.groups.find(x => x.id === context.groupId);

            // If it's a folder, make sure we find the group member based on the actual name
            const memberName = spriteFolderName.split('/')[0] ?? spriteFolderName;

            const groupMember = group.members
                .map(member => context.characters.find(x => x.avatar === member))
                .find(groupMember => groupMember && groupMember.name === memberName);
            if (groupMember) {
                await setImage($(`.expression-holder[data-avatar="${groupMember.avatar}"] img`), spriteFile.imageSrc);
                return;
            }
        }

        //only swap expressions when necessary
        if (prevExpressionSrc !== spriteFile.imageSrc
            && !img.hasClass('expression-animating')) {
            //clone expression
            expressionClone.addClass('expression-clone');
            //make invisible and remove id to prevent double ids
            //must be made invisible to start because they share the same Z-index
            expressionClone.attr('id', '').css({ opacity: 0 });
            //add new sprite path to clone src
            expressionClone.attr('src', spriteFile.imageSrc);
            //set relevant data tags
            expressionClone.attr('data-sprite-folder-name', spriteFolderName);
            expressionClone.attr('data-expression', expression);
            expressionClone.attr('data-sprite-filename', spriteFile.fileName);
            expressionClone.attr('title', expression);
            //add invisible clone to html
            expressionClone.appendTo($('#expression-holder'));

            const duration = 200;

            //add animation flags to both images
            //to prevent multiple expression changes happening simultaneously
            img.addClass('expression-animating');

            // Set the parent container's min width and height before running the transition
            const imgWidth = img.width();
            const imgHeight = img.height();
            const expressionHolder = img.parent();
            expressionHolder.css('min-width', imgWidth > 100 ? imgWidth : 100);
            expressionHolder.css('min-height', imgHeight > 100 ? imgHeight : 100);

            //position absolute prevent the original from jumping around during transition
            img.css('position', 'absolute').width(imgWidth).height(imgHeight);
            expressionClone.addClass('expression-animating');
            //fade the clone in
            expressionClone.css({
                opacity: 0,
            }).animate({
                opacity: 1,
            }, duration)
                //when finshed fading in clone, fade out the original
                .promise().done(function () {
                    img.animate({
                        opacity: 0,
                    }, duration);
                    //remove old expression
                    img.remove();
                    //replace ID so it becomes the new 'original' expression for next change
                    expressionClone.attr('id', 'expression-image');
                    expressionClone.removeClass('expression-animating');

                    // Reset the expression holder min height and width
                    expressionHolder.css('min-width', 100);
                    expressionHolder.css('min-height', 100);
                });

            expressionClone.removeClass('expression-clone');

            expressionClone.removeClass('default');
            expressionClone.off('error');
            expressionClone.on('error', function (error) {
                console.debug('Expression image error', spriteFile.imageSrc, error);
                $(this).attr('src', '');
                $(this).off('error');
                if (force && extension_settings.expressions.showDefault) {
                    setDefaultEmojiForImage(img, expression);
                }
            });
        }

        console.info('Expression set', { expression: spriteFile.expression, file: spriteFile.fileName });
    }
    else {
        img.attr('data-sprite-folder-name', spriteFolderName);

        img.off('error');

        if (extension_settings.expressions.showDefault && expression !== RESET_SPRITE_LABEL) {
            setDefaultEmojiForImage(img, expression);
        } else {
            setNoneForImage(img, expression);
        }
        console.debug('Expression unset - No sprite found', { expression: expression });
    }

    document.getElementById('expression-holder').style.display = '';
}

/**
 * Sets the default expression image for the given image element and expression
 * @param {JQuery<HTMLElement>} img - The image element to set the default expression for
 * @param {string} expression - The expression label to use for the default image
 */
function setDefaultEmojiForImage(img, expression) {
    if (extension_settings.expressions.custom?.includes(expression)) {
        console.debug(`Can't set default emoji for a custom expression (${expression}). setting to ${DEFAULT_FALLBACK_EXPRESSION} instead.`);
        expression = DEFAULT_FALLBACK_EXPRESSION;
    }

    const defImgUrl = `/img/default-expressions/${expression}.png`;
    img.attr('src', defImgUrl);
    img.attr('data-expression', expression);
    img.attr('data-sprite-filename', null);
    img.attr('title', expression);
    img.addClass('default');
}

/**
 * Sets the image element to display no expression by clearing its source attribute.
 * @param {JQuery<HTMLElement>} img - The image element to clear the expression for
 * @param {string} expression - The expression label to use
 */
function setNoneForImage(img, expression) {
    img.attr('src', '');
    img.attr('data-expression', expression);
    img.attr('data-sprite-filename', null);
    img.attr('title', expression);
    img.removeClass('default');
}

function onClickExpressionImage() {
    // If there is no expression image and we clicked on the placeholder, we remove the sprite by calling via the expression label
    if ($(this).attr('data-expression-type') === 'failure') {
        const label = $(this).attr('data-expression');
        setSpriteSlashCommand({ type: 'expression' }, label);
        return;
    }

    const spriteFile = $(this).attr('data-filename');
    setSpriteSlashCommand({ type: 'sprite' }, spriteFile);
}

async function onClickExpressionAddCustom() {
    const template = await renderExtensionTemplateAsync(MODULE_NAME, 'add-custom-expression');
    let expressionName = await Popup.show.input(null, template);

    if (!expressionName) {
        console.debug('No custom expression name provided');
        return;
    }

    expressionName = expressionName.trim().toLowerCase();

    // a-z, 0-9, dashes and underscores only
    if (!/^[a-z0-9-_]+$/.test(expressionName)) {
        toastr.warning('Invalid custom expression name provided', 'Add Custom Expression');
        return;
    }
    if (DEFAULT_EXPRESSIONS.includes(expressionName) || DEFAULT_EXPRESSIONS.some(x => expressionName.startsWith(x))) {
        toastr.warning('Expression name already exists', 'Add Custom Expression');
        return;
    }
    if (extension_settings.expressions.custom.includes(expressionName)) {
        toastr.warning('Custom expression already exists', 'Add Custom Expression');
        return;
    }

    // Add custom expression into settings
    extension_settings.expressions.custom.push(expressionName);
    await renderAdditionalExpressionSettings();
    saveSettingsDebounced();

    // Force refresh sprites list
    expressionsList = null;
    spriteCache = {};
    moduleWorker();
}

async function onClickExpressionRemoveCustom() {
    const selectedExpression = String($('#expression_custom').val());
    const noCustomExpressions = extension_settings.expressions.custom.length === 0;

    if (!selectedExpression || noCustomExpressions) {
        console.debug('No custom expression selected');
        return;
    }

    const template = await renderExtensionTemplateAsync(MODULE_NAME, 'remove-custom-expression', { expression: selectedExpression });
    const confirmation = await Popup.show.confirm(null, template);

    if (!confirmation) {
        console.debug('Custom expression removal cancelled');
        return;
    }

    // Remove custom expression from settings
    const index = extension_settings.expressions.custom.indexOf(selectedExpression);
    extension_settings.expressions.custom.splice(index, 1);
    if (selectedExpression == extension_settings.expressions.fallback_expression) {
        toastr.warning(`Deleted custom expression '${selectedExpression}' that was also selected as the fallback expression.\nFallback expression has been reset to '${DEFAULT_FALLBACK_EXPRESSION}'.`, 'Remove Custom Expression');
        extension_settings.expressions.fallback_expression = DEFAULT_FALLBACK_EXPRESSION;
    }
    await renderAdditionalExpressionSettings();
    saveSettingsDebounced();

    // Force refresh sprites list
    expressionsList = null;
    spriteCache = {};
    moduleWorker();
}

function onExpressionApiChanged() {
    const tempApi = this.value;
    if (tempApi) {
        extension_settings.expressions.api = Number(tempApi);
        $('.expression_llm_prompt_block').toggle([EXPRESSION_API.llm, EXPRESSION_API.webllm].includes(extension_settings.expressions.api));
        $('.expression_prompt_type_block').toggle(extension_settings.expressions.api === EXPRESSION_API.llm);
        expressionsList = null;
        spriteCache = {};
        moduleWorker();
        saveSettingsDebounced();
    }
}

async function onExpressionFallbackChanged() {
    /** @type {HTMLSelectElement} */
    const select = this;
    const selectedValue = select.value;

    switch (selectedValue) {
        case OPTION_NO_FALLBACK:
            extension_settings.expressions.fallback_expression = null;
            extension_settings.expressions.showDefault = false;
            break;
        case OPTION_EMOJI_FALLBACK:
            extension_settings.expressions.fallback_expression = null;
            extension_settings.expressions.showDefault = true;
            break;
        default:
            extension_settings.expressions.fallback_expression = selectedValue;
            extension_settings.expressions.showDefault = false;
            break;
    }

    const img = $('img.expression');
    const spriteFolderName = img.attr('data-sprite-folder-name');
    const expression = img.attr('data-expression');

    if (spriteFolderName && expression) {
        await sendExpressionCall(spriteFolderName, expression, { force: true });
    }

    saveSettingsDebounced();
}

async function handleFileUpload(url, formData) {
    try {
        const data = await jQuery.ajax({
            type: 'POST',
            url: url,
            data: formData,
            beforeSend: function () { },
            cache: false,
            contentType: false,
            processData: false,
        });

        // Refresh sprites list
        const name = formData.get('name');
        delete spriteCache[name];
        await fetchImagesNoCache();
        await validateImages(name);

        return data;
    } catch (error) {
        toastr.error('Failed to upload image');
    }
}

/**
 * Removes the file extension from a file name
 * @param {string} fileName The file name to remove the extension from
 * @returns {string} The file name without the extension
 */
function withoutExtension(fileName) {
    return fileName.replace(/\.[^/.]+$/, '');
}

function validateExpressionSpriteName(expression, spriteName) {
    const filenameValidationRegex = new RegExp(`^${expression}(?:[-\\.].*?)?$`);
    const validFileName = filenameValidationRegex.test(spriteName);
    return validFileName;
}

async function onClickExpressionUpload(event) {
    // Prevents the expression from being set
    event.stopPropagation();

    const expressionListItem = $(this).closest('.expression_list_item');

    const clickedFileName = expressionListItem.attr('data-expression-type') !== 'failure' ? expressionListItem.attr('data-filename') : null;
    const expression = expressionListItem.data('expression');
    const name = $('#image_list').data('name');

    const handleExpressionUploadChange = async (e) => {
        const file = e.target.files[0];

        if (!file || !file.name) {
            console.debug('No valid file selected');
            return;
        }

        const existingFiles = spriteCache[name]?.find(x => x.label === expression)?.files || [];

        let spriteName = expression;

        if (extension_settings.expressions.allowMultiple) {
            const matchesExisting = existingFiles.some(x => x.fileName === file.name);
            const fileNameWithoutExtension = withoutExtension(file.name);
            const validFileName = validateExpressionSpriteName(expression, fileNameWithoutExtension);

            // If there is no expression yet and it's a valid expression, we just take it
            if (!clickedFileName && validFileName) {
                spriteName = fileNameWithoutExtension;
            }
            // If the filename matches the one that was clicked, we just take it and replace it
            else if (clickedFileName === file.name) {
                spriteName = fileNameWithoutExtension;
            }
            // If it's a valid filename and there's no existing file with the same name, we just take it
            else if (!matchesExisting && validFileName) {
                spriteName = fileNameWithoutExtension;
            }
            else {
                /** @type {import('../../popup.js').CustomPopupButton[]} */
                const customButtons = [];
                if (clickedFileName) {
                    customButtons.push({
                        text: t`Replace Existing`,
                        result: POPUP_RESULT.NEGATIVE,
                        action: () => {
                            console.debug('Replacing existing sprite');
                            spriteName = withoutExtension(clickedFileName);
                        },
                    });
                }

                spriteName = null;
                const suggestedSpriteName = generateUniqueSpriteName(expression, existingFiles);

                const message = await renderExtensionTemplateAsync(MODULE_NAME, 'templates/upload-expression', { expression, clickedFileName });

                const input = await Popup.show.input(t`Upload Expression Sprite`, message,
                    suggestedSpriteName, { customButtons: customButtons });

                if (input) {
                    if (!validateExpressionSpriteName(expression, input)) {
                        toastr.warning(t`The name you entered does not follow the naming schema for the selected expression '${expression}'.`, t`Invalid Expression Sprite Name`);
                        return;
                    }
                    spriteName = input;
                }
            }
        } else {
            spriteName = withoutExtension(expression);
        }

        if (!spriteName) {
            toastr.warning(t`Cancelled uploading sprite.`, t`Upload Cancelled`);
            // Reset the input
            e.target.form.reset();
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('label', expression);
        formData.append('avatar', file);
        formData.append('spriteName', spriteName);

        await handleFileUpload('/api/sprites/upload', formData);

        // Reset the input
        e.target.form.reset();
    };

    $('#expression_upload')
        .off('change')
        .on('change', handleExpressionUploadChange)
        .trigger('click');
}

async function onClickExpressionOverrideButton() {
    const context = getContext();
    const currentLastMessage = getLastCharacterMessage();
    const avatarFileName = getFolderNameByMessage(currentLastMessage);

    // If the avatar name couldn't be found, abort.
    if (!avatarFileName) {
        console.debug(`Could not find filename for character with name ${currentLastMessage.name} and ID ${context.characterId}`);

        return;
    }

    const overridePath = String($('#expression_override').val());
    const existingOverrideIndex = extension_settings.expressionOverrides.findIndex((e) =>
        e.name == avatarFileName,
    );

    // If the path is empty, delete the entry from overrides
    if (overridePath === undefined || overridePath.length === 0) {
        if (existingOverrideIndex === -1) {
            return;
        }

        extension_settings.expressionOverrides.splice(existingOverrideIndex, 1);
        console.debug(`Removed existing override for ${avatarFileName}`);
    } else {
        // Properly override objects and clear the sprite cache of the previously set names
        const existingOverride = extension_settings.expressionOverrides[existingOverrideIndex];
        if (existingOverride) {
            Object.assign(existingOverride, { path: overridePath });
            delete spriteCache[existingOverride.name];
        } else {
            const characterOverride = { name: avatarFileName, path: overridePath };
            extension_settings.expressionOverrides.push(characterOverride);
            delete spriteCache[currentLastMessage.name];
        }

        console.debug(`Added/edited expression override for character with filename ${avatarFileName} to folder ${overridePath}`);
    }

    saveSettingsDebounced();

    // Refresh sprites list. Assume the override path has been properly handled.
    try {
        inApiCall = true;
        $('#visual-novel-wrapper').empty();
        await validateImages(overridePath.length === 0 ? currentLastMessage.name : overridePath, true);
        const name = overridePath.length === 0 ? currentLastMessage.name : overridePath;
        const expression = await getExpressionLabel(currentLastMessage.mes);
        await sendExpressionCall(name, expression, { force: true });
        forceUpdateVisualNovelMode();
    } catch (error) {
        console.debug(`Setting expression override for ${avatarFileName} failed with error: ${error}`);
    } finally {
        inApiCall = false;
    }
}

async function onClickExpressionOverrideRemoveAllButton() {
    // Remove all the overrided entries from sprite cache
    for (const element of extension_settings.expressionOverrides) {
        delete spriteCache[element.name];
    }

    extension_settings.expressionOverrides = [];
    saveSettingsDebounced();

    console.debug('All expression image overrides have been cleared.');

    // Refresh sprites list to use the default name if applicable
    try {
        $('#visual-novel-wrapper').empty();
        const currentLastMessage = getLastCharacterMessage();
        await validateImages(currentLastMessage.name, true);
        const expression = await getExpressionLabel(currentLastMessage.mes);
        await sendExpressionCall(currentLastMessage.name, expression, { force: true });
        forceUpdateVisualNovelMode();

        console.debug(extension_settings.expressionOverrides);
    } catch (error) {
        console.debug(`The current expression could not be set because of error: ${error}`);
    }
}

async function onClickExpressionUploadPackButton() {
    const name = $('#image_list').data('name');

    const handleFileUploadChange = async (e) => {
        const file = e.target.files[0];

        if (!file) {
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('avatar', file);

        const uploadToast = toastr.info('Please wait...', 'Upload is processing', { timeOut: 0, extendedTimeOut: 0 });
        const { count } = await handleFileUpload('/api/sprites/upload-zip', formData);
        toastr.clear(uploadToast);
        toastr.success(`Uploaded ${count} image(s) for ${name}`);

        // Reset the input
        e.target.form.reset();
    };

    $('#expression_upload_pack')
        .off('change')
        .on('change', handleFileUploadChange)
        .trigger('click');
}

async function onClickExpressionDelete(event) {
    // Prevents the expression from being set
    event.stopPropagation();

    const expressionListItem = $(this).closest('.expression_list_item');
    const expression = expressionListItem.data('expression');

    if (expressionListItem.attr('data-expression-type') === 'failure') {
        return;
    }

    const confirmation = await Popup.show.confirm(t`Delete Expression`, t`Are you sure you want to delete this expression? Once deleted, it\'s gone forever!`
        + '<br /><br />'
        + t`Expression:` + ' <tt>' + expressionListItem.attr('data-filename') + '</tt>');
    if (!confirmation) {
        return;
    }

    const fileName = withoutExtension(expressionListItem.attr('data-filename'));
    const name = $('#image_list').data('name');

    try {
        await fetch('/api/sprites/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name, label: expression, spriteName: fileName }),
        });
    } catch (error) {
        toastr.error('Failed to delete image. Try again later.');
    }

    // Refresh sprites list
    delete spriteCache[name];
    await fetchImagesNoCache();
    await validateImages(name);
}

function setExpressionOverrideHtml(forceClear = false) {
    const currentLastMessage = getLastCharacterMessage();
    const avatarFileName = getFolderNameByMessage(currentLastMessage);
    if (!avatarFileName) {
        return;
    }

    const expressionOverride = extension_settings.expressionOverrides.find((e) =>
        e.name == avatarFileName,
    );

    if (expressionOverride && expressionOverride.path) {
        $('#expression_override').val(expressionOverride.path);
    } else if (expressionOverride) {
        delete extension_settings.expressionOverrides[expressionOverride.name];
    }

    if (forceClear && !expressionOverride) {
        $('#expression_override').val('');
    }
}

async function fetchImagesNoCache() {
    const promises = [];
    $('#image_list img').each(function () {
        const src = $(this).attr('src');

        if (!src) {
            return;
        }

        const promise = fetch(src, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
        promises.push(promise);
    });

    return await Promise.allSettled(promises);
}

function migrateSettings() {
    if (extension_settings.expressions.api === undefined) {
        extension_settings.expressions.api = EXPRESSION_API.none;
        saveSettingsDebounced();
    }

    if (Object.keys(extension_settings.expressions).includes('local')) {
        if (extension_settings.expressions.local) {
            extension_settings.expressions.api = EXPRESSION_API.local;
        }

        delete extension_settings.expressions.local;
        saveSettingsDebounced();
    }

    if (extension_settings.expressions.llmPrompt === undefined) {
        extension_settings.expressions.llmPrompt = DEFAULT_LLM_PROMPT;
        saveSettingsDebounced();
    }

    if (extension_settings.expressions.allowMultiple === undefined) {
        extension_settings.expressions.allowMultiple = true;
        saveSettingsDebounced();
    }

    if (extension_settings.expressions.showDefault && extension_settings.expressions.fallback_expression !== undefined) {
        extension_settings.expressions.showDefault = false;
        saveSettingsDebounced();
    }

    if (extension_settings.expressions.promptType === undefined) {
        extension_settings.expressions.promptType = PROMPT_TYPE.raw;
        saveSettingsDebounced();
    }
}

(async function () {
    function addExpressionImage() {
        const html = `
        <div id="expression-wrapper">
            <div id="expression-holder" class="expression-holder" style="display:none;">
                <div id="expression-holderheader" class="fa-solid fa-grip drag-grabber"></div>
                <img id="expression-image" class="expression">
            </div>
        </div>`;
        $('body').append(html);
        loadMovingUIState();
    }
    function addVisualNovelMode() {
        const html = `
        <div id="visual-novel-wrapper">
        </div>`;
        const element = $(html);
        element.hide();
        $('body').append(element);
    }
    async function addSettings() {
        const template = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');
        $('#expressions_container').append(template);
        $('#expression_override_button').on('click', onClickExpressionOverrideButton);
        $('#expression_upload_pack_button').on('click', onClickExpressionUploadPackButton);
        $('#expression_translate').prop('checked', extension_settings.expressions.translate).on('input', function () {
            extension_settings.expressions.translate = !!$(this).prop('checked');
            saveSettingsDebounced();
        });
        $('#expressions_allow_multiple').prop('checked', extension_settings.expressions.allowMultiple).on('input', function () {
            extension_settings.expressions.allowMultiple = !!$(this).prop('checked');
            saveSettingsDebounced();
        });
        $('#expressions_reroll_if_same').prop('checked', extension_settings.expressions.rerollIfSame).on('input', function () {
            extension_settings.expressions.rerollIfSame = !!$(this).prop('checked');
            saveSettingsDebounced();
        });
        $('#expressions_filter_available').prop('checked', extension_settings.expressions.filterAvailable).on('input', function () {
            extension_settings.expressions.filterAvailable = !!$(this).prop('checked');
            saveSettingsDebounced();
        });
        $('#expression_override_cleanup_button').on('click', onClickExpressionOverrideRemoveAllButton);
        $(document).on('dragstart', '.expression', (e) => {
            e.preventDefault();
            return false;
        });
        $(document).on('click', '.expression_list_item', onClickExpressionImage);
        $(document).on('click', '.expression_list_upload', onClickExpressionUpload);
        $(document).on('click', '.expression_list_delete', onClickExpressionDelete);
        $(window).on('resize', () => updateVisualNovelModeDebounced());
        $('#open_chat_expressions').hide();

        await renderAdditionalExpressionSettings();
        $('#expression_api').val(extension_settings.expressions.api ?? EXPRESSION_API.none);
        $('.expression_llm_prompt_block').toggle([EXPRESSION_API.llm, EXPRESSION_API.webllm].includes(extension_settings.expressions.api));
        $('#expression_llm_prompt').val(extension_settings.expressions.llmPrompt ?? '');
        $('#expression_llm_prompt').on('input', function () {
            extension_settings.expressions.llmPrompt = String($(this).val());
            saveSettingsDebounced();
        });
        $('#expression_llm_prompt_restore').on('click', function () {
            $('#expression_llm_prompt').val(DEFAULT_LLM_PROMPT);
            extension_settings.expressions.llmPrompt = DEFAULT_LLM_PROMPT;
            saveSettingsDebounced();
        });
        $('#expression_prompt_raw').on('input', function () {
            extension_settings.expressions.promptType = PROMPT_TYPE.raw;
            saveSettingsDebounced();
        });
        $('#expression_prompt_full').on('input', function () {
            extension_settings.expressions.promptType = PROMPT_TYPE.full;
            saveSettingsDebounced();
        });
        $(`input[name="expression_prompt_type"][value="${extension_settings.expressions.promptType}"]`).prop('checked', true);
        $('.expression_prompt_type_block').toggle(extension_settings.expressions.api === EXPRESSION_API.llm);

        $('#expression_custom_add').on('click', onClickExpressionAddCustom);
        $('#expression_custom_remove').on('click', onClickExpressionRemoveCustom);
        $('#expression_fallback').on('change', onExpressionFallbackChanged);
        $('#expression_api').on('change', onExpressionApiChanged);
    }

    addExpressionImage();
    addVisualNovelMode();
    migrateSettings();
    await addSettings();
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    const updateFunction = wrapper.update.bind(wrapper);
    setInterval(updateFunction, UPDATE_INTERVAL);
    moduleWorker();
    dragElement($('#expression-holder'));
    eventSource.on(event_types.CHAT_CHANGED, () => {
        // character changed
        removeExpression();
        spriteCache = {};
        lastExpression = {};

        //clear expression
        let imgElement = document.getElementById('expression-image');
        if (imgElement && imgElement instanceof HTMLImageElement) {
            imgElement.src = '';
        }

        setExpressionOverrideHtml(true); // force-clear, as the character might not have an override defined

        if (isVisualNovelMode()) {
            $('#visual-novel-wrapper').empty();
        }

        updateFunction({ newChat: true });
    });
    eventSource.on(event_types.MOVABLE_PANELS_RESET, updateVisualNovelModeDebounced);
    eventSource.on(event_types.GROUP_UPDATED, updateVisualNovelModeDebounced);

    const localEnumProviders = {
        expressions: () => {
            const currentLastMessage = selected_group ? getLastCharacterMessage() : null;
            const spriteFolderName = getSpriteFolderName(currentLastMessage, currentLastMessage?.name);
            const expressions = getCachedExpressions();
            return expressions.map(expression => {
                const spriteCount = spriteCache[spriteFolderName]?.find(x => x.label === expression)?.files.length ?? 0;
                const isCustom = extension_settings.expressions.custom?.includes(expression);
                const subtitle = spriteCount == 0 ? '❌ No sprites available for this expression' :
                    spriteCount > 1 ? `${spriteCount} sprites` : null;
                return new SlashCommandEnumValue(expression,
                    subtitle,
                    isCustom ? enumTypes.name : enumTypes.enum,
                    isCustom ? 'C' : 'D');
            });
        },
        sprites: () => {
            const currentLastMessage = selected_group ? getLastCharacterMessage() : null;
            const spriteFolderName = getSpriteFolderName(currentLastMessage, currentLastMessage?.name);
            const sprites = spriteCache[spriteFolderName]?.map(x => x.files)?.flat() ?? [];
            return sprites.map(x => {
                return new SlashCommandEnumValue(x.title,
                    x.title !== x.expression ? x.expression : null,
                    x.isCustom ? enumTypes.name : enumTypes.enum,
                    x.isCustom ? 'C' : 'D');
            });
        },
    };

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'expression-set',
        aliases: ['sprite', 'emote'],
        callback: setSpriteSlashCommand,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'type',
                description: 'Whether to set an expression or a specific sprite.',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'expression',
                enumList: ['expression', 'sprite'],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'expression label to set',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: (executor, _) => {
                    // Check if command is used to set a sprite, then use those enums
                    const type = executor.namedArgumentList.find(it => it.name == 'type')?.value || 'expression';
                    if (type == 'sprite') return localEnumProviders.sprites();
                    else return [
                        ...localEnumProviders.expressions(),
                        new SlashCommandEnumValue(RESET_SPRITE_LABEL, 'Resets the expression (to either default or no sprite)', enumTypes.enum, '❌'),
                    ];
                },
            }),
        ],
        helpString: 'Force sets the expression for the current character.',
        returns: 'The currently set expression label after setting it.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'expression-folder-override',
        aliases: ['spriteoverride', 'costume'],
        callback: setSpriteFolderCommand,
        unnamedArgumentList: [
            new SlashCommandArgument(
                'optional folder', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: `
            <div>
                Sets an override sprite folder for the current character.<br />
                In groups, this will apply to the character who last sent a message.
            </div>
            <div>
                If the name starts with a slash or a backslash, selects a sub-folder in the character-named folder. Empty value to reset to default.
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'expression-last',
        aliases: ['lastsprite'],
        /** @type {(args: object, name: string) => Promise<string>} */
        callback: async (_, name) => {
            if (typeof name !== 'string') throw new Error('name must be a string');
            if (!name) {
                if (selected_group) {
                    toastr.error(t`In group chats, you must specify a character name.`, t`No character name specified`);
                    return '';
                }
                name = characters[this_chid]?.avatar;
            }

            const char = findChar({ name: name });
            if (!char) toastr.warning(t`Couldn't find character ${name}.`, t`Character not found`);

            const sprite = lastExpression[char?.name ?? name] ?? '';
            return sprite;
        },
        returns: 'the last set expression for the named character.',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Character name - or unique character identifier (avatar key). If not provided, the current character for this chat will be used (does not work in group chats)',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: commonEnumProviders.characters('character'),
            }),
        ],
        helpString: 'Returns the last set expression for the named character.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'expression-list',
        aliases: ['expressions'],
        /** @type {(args: {return: string, filter: string}) => Promise<string>} */
        callback: async (args) => {
            let returnType =
                /** @type {import('../../slash-commands/SlashCommandReturnHelper.js').SlashCommandReturnType} */
                (args.return);

            const list = await getExpressionsList({ filterAvailable: !isFalseBoolean(args.filter) });

            return await slashCommandReturnHelper.doReturn(returnType ?? 'pipe', list, { objectToStringFunc: list => list.join(', ') });
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'return',
                description: 'The way how you want the return value to be provided',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'pipe',
                enumList: slashCommandReturnHelper.enumList({ allowObject: true }),
                forceEnum: true,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'filter',
                description: 'Filter the list to only include expressions that have available sprites for the current character.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'true',
            }),
        ],
        returns: 'The comma-separated list of available expressions, including custom expressions.',
        helpString: 'Returns a list of available expressions, including custom expressions.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'expression-classify',
        aliases: ['classify'],
        callback: classifyCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'api',
                description: 'The Classifier API to classify with. If not specified, the configured one will be used.',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: Object.keys(EXPRESSION_API).map(api => new SlashCommandEnumValue(api, null, enumTypes.enum)),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'filter',
                description: 'Filter the list to only include expressions that have available sprites for the current character.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'true',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'prompt',
                description: 'Custom prompt for classification. Only relevant if Classifier API is set to LLM.',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        returns: 'emotion classification label for the given text',
        helpString: `
            <div>
                Performs an emotion classification of the given text and returns a label.
            </div>
            <div>
                Allows to specify which Classifier API to perform the classification with.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/classify I am so happy today!</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'expression-upload',
        aliases: ['uploadsprite'],
        /** @type {(args: {name: string, label: string, folder: string?, spriteName: string?}, url: string) => Promise<string>} */
        callback: async (args, url) => {
            return await uploadSpriteCommand(args, url);
        },
        returns: 'the resulting sprite name',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'URL of the image to upload',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: 'Character name or avatar key (default is current character)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'label',
                description: 'Sprite label/expression name',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: localEnumProviders.expressions,
                isRequired: true,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'folder',
                description: 'Override folder to upload into',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'spriteName',
                description: 'Override sprite name to allow multiple sprites per expressions. Has to follow the naming pattern. If unspecified, the label will be used as sprite name.',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: `
            <div>
                Upload a sprite from a URL.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/uploadsprite name=Seraphina label=joy /user/images/Seraphina/Seraphina_2024-12-22@12h37m57s.png</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
})();
