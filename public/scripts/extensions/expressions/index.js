import { callPopup, eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from '../../../script.js';
import { dragElement, isMobile } from '../../RossAscends-mods.js';
import { getContext, getApiUrl, modules, extension_settings, ModuleWorkerWrapper, doExtrasFetch, renderExtensionTemplate } from '../../extensions.js';
import { loadMovingUIState, power_user } from '../../power-user.js';
import { registerSlashCommand } from '../../slash-commands.js';
import { onlyUnique, debounce, getCharaFilename, trimToEndSentence, trimToStartSentence } from '../../utils.js';
import { hideMutedSprites } from '../../group-chats.js';
export { MODULE_NAME };

const MODULE_NAME = 'expressions';
const UPDATE_INTERVAL = 2000;
const STREAMING_UPDATE_INTERVAL = 6000;
const TALKINGCHECK_UPDATE_INTERVAL = 500;
const FALLBACK_EXPRESSION = 'joy';
const DEFAULT_EXPRESSIONS = [
    'talkinghead',
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

let expressionsList = null;
let lastCharacter = undefined;
let lastMessage = null;
let lastTalkingState = false;
let lastTalkingStateMessage = null;  // last message as seen by `updateTalkingState` (tracked separately, different timer)
let spriteCache = {};
let inApiCall = false;
let lastServerResponseTime = 0;
export let lastExpression = {};

function isTalkingHeadEnabled() {
    return extension_settings.expressions.talkinghead && !extension_settings.expressions.local;
}

/**
 * Toggles Talkinghead mode on/off.
 *
 * Implements the `/th` slash command, which is meant to be bound to a Quick Reply button
 * as a quick way to switch Talkinghead on or off (e.g. to conserve GPU resources when AFK
 * for a long time).
 */
function toggleTalkingHeadCommand(_) {
    setTalkingHeadState(!extension_settings.expressions.talkinghead);
}

function isVisualNovelMode() {
    return Boolean(!isMobile() && power_user.waifuMode && getContext().groupId);
}

async function forceUpdateVisualNovelMode() {
    if (isVisualNovelMode()) {
        await updateVisualNovelMode();
    }
}

const updateVisualNovelModeDebounced = debounce(forceUpdateVisualNovelMode, 100);

async function updateVisualNovelMode(name, expression) {
    const container = $('#visual-novel-wrapper');

    await visualNovelRemoveInactive(container);

    const setSpritePromises = await visualNovelSetCharacterSprites(container, name, expression);

    // calculate layer indices based on recent messages
    await visualNovelUpdateLayers(container);

    await Promise.allSettled(setSpritePromises);

    // update again based on new sprites
    if (setSpritePromises.length > 0) {
        await visualNovelUpdateLayers(container);
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

async function visualNovelSetCharacterSprites(container, name, expression) {
    const context = getContext();
    const group = context.groups.find(x => x.id == context.groupId);
    const labels = await getExpressionsList();

    const createCharacterPromises = [];
    const setSpritePromises = [];

    for (const avatar of group.members) {
        const isDisabled = group.disabled_members.includes(avatar);

        // skip disabled characters
        if (isDisabled && hideMutedSprites) {
            continue;
        }

        const character = context.characters.find(x => x.avatar == avatar);

        if (!character) {
            continue;
        }

        const spriteFolderName = getSpriteFolderName({ original_avatar: character.avatar }, character.name);

        // download images if not downloaded yet
        if (spriteCache[spriteFolderName] === undefined) {
            spriteCache[spriteFolderName] = await getSpritesList(spriteFolderName);
        }

        const sprites = spriteCache[spriteFolderName];
        const expressionImage = container.find(`.expression-holder[data-avatar="${avatar}"]`);
        const defaultSpritePath = sprites.find(x => x.label === FALLBACK_EXPRESSION)?.path;
        const noSprites = sprites.length === 0;

        if (expressionImage.length > 0) {
            if (name == spriteFolderName) {
                await validateImages(spriteFolderName, true);
                setExpressionOverrideHtml(true); // <= force clear expression override input
                const currentSpritePath = labels.includes(expression) ? sprites.find(x => x.label === expression)?.path : '';

                const path = currentSpritePath || defaultSpritePath || '';
                const img = expressionImage.find('img');
                await setImage(img, path);
            }
            expressionImage.toggleClass('hidden', noSprites);
        } else {
            const template = $('#expression-holder').clone();
            template.attr('id', `expression-${avatar}`);
            template.attr('data-avatar', avatar);
            template.find('.drag-grabber').attr('id', `expression-${avatar}header`);
            $('#visual-novel-wrapper').append(template);
            dragElement($(template[0]));
            template.toggleClass('hidden', noSprites);
            await setImage(template.find('img'), defaultSpritePath || '');
            const fadeInPromise = new Promise(resolve => {
                template.fadeIn(250, () => resolve());
            });
            createCharacterPromises.push(fadeInPromise);
            const setSpritePromise = setLastMessageSprite(template.find('img'), avatar, labels);
            setSpritePromises.push(setSpritePromise);
        }
    }

    await Promise.allSettled(createCharacterPromises);
    return setSpritePromises;
}

async function visualNovelUpdateLayers(container) {
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

    let images = $('#visual-novel-wrapper .expression-holder');
    let imagesWidth = [];

    images.sort(sortFunction).each(function () {
        imagesWidth.push($(this).width());
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

    images.sort(sortFunction).each((index, current) => {
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
            element.animate({ left: currentPosition + 'px' }, 500, () => {
                resolve();
            });
        });

        currentPosition += imagesWidth[index];

        setLayerIndicesPromises.push(promise);
    });

    await Promise.allSettled(setLayerIndicesPromises);
}

async function setLastMessageSprite(img, avatar, labels) {
    const context = getContext();
    const lastMessage = context.chat.slice().reverse().find(x => x.original_avatar == avatar || (x.force_avatar && x.force_avatar.includes(encodeURIComponent(avatar))));

    if (lastMessage) {
        const text = lastMessage.mes || '';
        const spriteFolderName = getSpriteFolderName(lastMessage, lastMessage.name);
        const sprites = spriteCache[spriteFolderName] || [];
        const label = await getExpressionLabel(text);
        const path = labels.includes(label) ? sprites.find(x => x.label === label)?.path : '';

        if (path) {
            setImage(img, path);
        }
    }
}

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
        const originalId = img.attr('id');

        //only swap expressions when necessary
        if (prevExpressionSrc !== path && !img.hasClass('expression-animating')) {
            //clone expression
            expressionClone.addClass('expression-clone');
            //make invisible and remove id to prevent double ids
            //must be made invisible to start because they share the same Z-index
            expressionClone.attr('id', '').css({ opacity: 0 });
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
                    expressionClone.attr('id', originalId);
                    expressionClone.removeClass('expression-animating');

                    // Reset the expression holder min height and width
                    expressionHolder.css('min-width', 100);
                    expressionHolder.css('min-height', 100);

                    resolve();
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

function onExpressionsShowDefaultInput() {
    const value = $(this).prop('checked');
    extension_settings.expressions.showDefault = value;
    saveSettingsDebounced();

    const existingImageSrc = $('img.expression').prop('src');
    if (existingImageSrc !== undefined) {                      //if we have an image in src
        if (!value && existingImageSrc.includes('/img/default-expressions/')) {    //and that image is from /img/ (default)
            $('img.expression').prop('src', '');               //remove it
            lastMessage = null;
        }
        if (value) {
            lastMessage = null;
        }
    }
}

/**
  * Stops animating Talkinghead.
  */
async function unloadTalkingHead() {
    if (!modules.includes('talkinghead')) {
        console.debug('talkinghead module is disabled');
        return;
    }
    console.debug('expressions: Stopping Talkinghead');

    try {
        const url = new URL(getApiUrl());
        url.pathname = '/api/talkinghead/unload';
        const loadResponse = await doExtrasFetch(url);
        if (!loadResponse.ok) {
            throw new Error(loadResponse.statusText);
        }
        //console.log(`Response: ${loadResponseText}`);
    } catch (error) {
        //console.error(`Error unloading - ${error}`);
    }
}

/**
  * Posts `talkinghead.png` of the current character to the talkinghead module in SillyTavern-extras, to start animating it.
  */
async function loadTalkingHead() {
    if (!modules.includes('talkinghead')) {
        console.debug('talkinghead module is disabled');
        return;
    }
    console.debug('expressions: Starting Talkinghead');

    const spriteFolderName = getSpriteFolderName();

    const talkingheadPath = `/characters/${encodeURIComponent(spriteFolderName)}/talkinghead.png`;
    const emotionsSettingsPath = `/characters/${encodeURIComponent(spriteFolderName)}/_emotions.json`;
    const animatorSettingsPath = `/characters/${encodeURIComponent(spriteFolderName)}/_animator.json`;

    try {
        const spriteResponse = await fetch(talkingheadPath);

        if (!spriteResponse.ok) {
            throw new Error(spriteResponse.statusText);
        }

        const spriteBlob = await spriteResponse.blob();
        const spriteFile = new File([spriteBlob], 'talkinghead.png', { type: 'image/png' });
        const formData = new FormData();
        formData.append('file', spriteFile);

        const url = new URL(getApiUrl());
        url.pathname = '/api/talkinghead/load';

        const loadResponse = await doExtrasFetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!loadResponse.ok) {
            throw new Error(loadResponse.statusText);
        }

        const loadResponseText = await loadResponse.text();
        console.log(`Load talkinghead response: ${loadResponseText}`);

        // Optional: per-character emotion templates
        let emotionsSettings;
        try {
            const emotionsResponse = await fetch(emotionsSettingsPath);
            if (emotionsResponse.ok) {
                emotionsSettings = await emotionsResponse.json();
                console.log(`Loaded ${emotionsSettingsPath}`);
            } else {
                throw new Error();
            }
        }
        catch (error) {
            emotionsSettings = {};  // blank -> use server defaults (to unload the previous character's customizations)
            console.log(`No valid config at ${emotionsSettingsPath}, using server defaults`);
        }
        try {
            const url = new URL(getApiUrl());
            url.pathname = '/api/talkinghead/load_emotion_templates';
            const apiResult = await doExtrasFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'bypass',
                },
                body: JSON.stringify(emotionsSettings),
            });
        }
        catch (error) {
            // it's ok if not supported
            console.log('Failed to send _emotions.json (backend too old?), ignoring');
        }

        // Optional: per-character animator and postprocessor config
        let animatorSettings;
        try {
            const animatorResponse = await fetch(animatorSettingsPath);
            if (animatorResponse.ok) {
                animatorSettings = await animatorResponse.json();
                console.log(`Loaded ${animatorSettingsPath}`);
            } else {
                throw new Error();
            }
        }
        catch (error) {
            animatorSettings = {};  // blank -> use server defaults (to unload the previous character's customizations)
            console.log(`No valid config at ${animatorSettingsPath}, using server defaults`);
        }
        try {
            const url = new URL(getApiUrl());
            url.pathname = '/api/talkinghead/load_animator_settings';
            const apiResult = await doExtrasFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'bypass',
                },
                body: JSON.stringify(animatorSettings),
            });
        }
        catch (error) {
            // it's ok if not supported
            console.log('Failed to send _animator.json (backend too old?), ignoring');
        }
    } catch (error) {
        console.error(`Error loading talkinghead image: ${talkingheadPath} - ${error}`);
    }
}

function handleImageChange() {
    const imgElement = document.querySelector('img#expression-image.expression');

    if (!imgElement || !(imgElement instanceof HTMLImageElement)) {
        console.log('Cannot find addExpressionImage()');
        return;
    }

    if (isTalkingHeadEnabled() && modules.includes('talkinghead')) {
        const talkingheadResultFeedSrc = `${getApiUrl()}/api/talkinghead/result_feed`;
        $('#expression-holder').css({ display: '' });
        if (imgElement.src !== talkingheadResultFeedSrc) {
            const expressionImageElement = document.querySelector('.expression_list_image');

            if (expressionImageElement && expressionImageElement instanceof HTMLImageElement) {
                doExtrasFetch(expressionImageElement.src, {
                    method: 'HEAD',
                })
                    .then(response => {
                        if (response.ok) {
                            imgElement.src = talkingheadResultFeedSrc;
                        }
                    })
                    .catch(error => {
                        console.error(error);
                    });
            }
        }
    } else {
        imgElement.src = '';  // remove in case char doesn't have expressions

        // When switching Talkinghead off, force-set the character to the last known expression, if any.
        // This preserves the same expression Talkinghead had at the moment it was switched off.
        const charName = getContext().name2;
        const last = lastExpression[charName];
        const targetExpression = last ? last : FALLBACK_EXPRESSION;
        setExpression(charName, targetExpression, true);
    }
}

async function moduleWorker() {
    const context = getContext();

    // Hide and disable Talkinghead while in local mode
    $('#image_type_block').toggle(!extension_settings.expressions.local);

    if (extension_settings.expressions.local && extension_settings.expressions.talkinghead) {
        $('#image_type_toggle').prop('checked', false);
        setTalkingHeadState(false);
    }

    // non-characters not supported
    if (!context.groupId && (context.characterId === undefined || context.characterId === 'invalid-safety-id')) {
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
    let spriteFolderName = context.groupId ? getSpriteFolderName(currentLastMessage, currentLastMessage.name) : getSpriteFolderName();

    // character has no expressions or it is not loaded
    if (Object.keys(spriteCache).length === 0) {
        await validateImages(spriteFolderName);
        lastCharacter = context.groupId || context.characterId;
    }

    const offlineMode = $('.expression_settings .offline_mode');
    if (!modules.includes('classify') && !extension_settings.expressions.local) {
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

    // Don't bother classifying if current char has no sprites and no default expressions are enabled
    if ((!Array.isArray(spriteCache[spriteFolderName]) || spriteCache[spriteFolderName].length === 0) && !extension_settings.expressions.showDefault) {
        return;
    }

    const lastMessageChanged = !((lastCharacter === context.characterId || lastCharacter === context.groupId) && lastMessage === currentLastMessage.mes);

    // check if last message changed
    if (!lastMessageChanged) {
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
        if (currentLastMessage.mes == '...' && expressionsList.includes(FALLBACK_EXPRESSION)) {
            expression = FALLBACK_EXPRESSION;
        }

        await sendExpressionCall(spriteFolderName, expression, force, vnMode);
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

/**
  * Starts/stops Talkinghead talking animation.
  *
  * Talking starts only when all the following conditions are met:
  *   - The LLM is currently streaming its output.
  *   - The AI's current last message is non-empty, and also not just '...' (as produced by a swipe).
  *   - The AI's current last message has changed from what we saw during the previous call.
  *
  * In all other cases, talking stops.
  *
  * A Talkinghead API call is made only when the talking state changes.
  *
  * Note that also the TTS system, if enabled, starts/stops the Talkinghead talking animation.
  * See `talkingAnimation` in `SillyTavern/public/scripts/extensions/tts/index.js`.
  */
async function updateTalkingState() {
    // Don't bother if Talkinghead is disabled or not loaded.
    if (!isTalkingHeadEnabled() || !modules.includes('talkinghead')) {
        return;
    }

    const context = getContext();
    const currentLastMessage = getLastCharacterMessage();

    try {
        // TODO: Not sure if we need also "&& !context.groupId" here - the classify check in `moduleWorker`
        //       (that similarly checks the streaming processor state) does that for some reason.
        //       Talkinghead isn't currently designed to work with groups.
        const lastMessageChanged = !((lastCharacter === context.characterId || lastCharacter === context.groupId) && lastTalkingStateMessage === currentLastMessage.mes);
        const url = new URL(getApiUrl());
        let newTalkingState;
        if (context.streamingProcessor && !context.streamingProcessor.isFinished &&
            currentLastMessage.mes.length !== 0 && currentLastMessage.mes !== '...' && lastMessageChanged) {
            url.pathname = '/api/talkinghead/start_talking';
            newTalkingState = true;
        } else {
            url.pathname = '/api/talkinghead/stop_talking';
            newTalkingState = false;
        }
        try {
            // Call the Talkinghead API only if the talking state changed.
            if (newTalkingState !== lastTalkingState) {
                console.debug(`updateTalkingState: calling ${url.pathname}`);
                await doExtrasFetch(url);
            }
        }
        catch (error) {
            // it's ok if not supported
        }
        finally {
            lastTalkingState = newTalkingState;
        }
    }
    catch (error) {
        // console.log(error);
    }
    finally {
        lastTalkingStateMessage = currentLastMessage.mes;
    }
}

/**
 * Checks whether the current character has a talkinghead image available.
 * @returns {Promise<boolean>} True if the character has a talkinghead image available, false otherwise.
 */
async function isTalkingHeadAvailable() {
    let spriteFolderName = getSpriteFolderName();

    try {
        await validateImages(spriteFolderName);

        let talkingheadObj = spriteCache[spriteFolderName].find(obj => obj.label === 'talkinghead');
        let talkingheadPath = talkingheadObj ? talkingheadObj.path : null;

        if (talkingheadPath != null) {
            return true;
        } else {
            await unloadTalkingHead();
            return false;
        }
    } catch (err) {
        return err;
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

function setTalkingHeadState(newState) {
    console.debug(`expressions: New talkinghead state: ${newState}`);
    extension_settings.expressions.talkinghead = newState; // Store setting
    saveSettingsDebounced();

    if (extension_settings.expressions.local) {
        return;
    }

    isTalkingHeadAvailable().then(result => {
        if (result) {
            //console.log("talkinghead exists!");

            if (extension_settings.expressions.talkinghead) {
                loadTalkingHead();
            } else {
                unloadTalkingHead();
            }
            handleImageChange(); // Change image as needed


        } else {
            //console.log("talkinghead does not exist.");
        }
    });
}

function getFolderNameByMessage(message) {
    const context = getContext();
    let avatarPath = '';

    if (context.groupId) {
        avatarPath = message.original_avatar || context.characters.find(x => message.force_avatar && message.force_avatar.includes(encodeURIComponent(x.avatar)))?.avatar;
    }
    else if (context.characterId) {
        avatarPath = getCharaFilename();
    }

    if (!avatarPath) {
        return '';
    }

    const folderName = avatarPath.replace(/\.[^/.]+$/, '');
    return folderName;
}

async function sendExpressionCall(name, expression, force, vnMode) {
    lastExpression[name.split('/')[0]] = expression;
    if (!vnMode) {
        vnMode = isVisualNovelMode();
    }

    if (vnMode) {
        await updateVisualNovelMode(name, expression);
    } else {
        setExpression(name, expression, force);
    }
}

async function setSpriteSetCommand(_, folder) {
    if (!folder) {
        console.log('Clearing sprite set');
        folder = '';
    }

    if (folder.startsWith('/') || folder.startsWith('\\')) {
        folder = folder.slice(1);

        const currentLastMessage = getLastCharacterMessage();
        folder = `${currentLastMessage.name}/${folder}`;
    }

    $('#expression_override').val(folder.trim());
    onClickExpressionOverrideButton();
    removeExpression();
    moduleWorker();
}

async function setSpriteSlashCommand(_, spriteId) {
    if (!spriteId) {
        console.log('No sprite id provided');
        return;
    }

    spriteId = spriteId.trim().toLowerCase();

    // In Talkinghead mode, don't check for the existence of the sprite
    // (emotion names are the same as for sprites, but it only needs "talkinghead.png").
    const currentLastMessage = getLastCharacterMessage();
    const spriteFolderName = getSpriteFolderName(currentLastMessage, currentLastMessage.name);
    let label = spriteId;
    if (!isTalkingHeadEnabled() || !modules.includes('talkinghead')) {
        await validateImages(spriteFolderName);

        // Fuzzy search for sprite
        const fuse = new Fuse(spriteCache[spriteFolderName], { keys: ['label'] });
        const results = fuse.search(spriteId);
        const spriteItem = results[0]?.item;

        if (!spriteItem) {
            console.log('No sprite found for search term ' + spriteId);
            return;
        }

        label = spriteItem.label;
    }

    const vnMode = isVisualNovelMode();
    await sendExpressionCall(spriteFolderName, label, true, vnMode);
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

    // Remove asterisks and quotes
    let result = text.replace(/[*"]/g, '');

    const SAMPLE_THRESHOLD = 500;
    const HALF_SAMPLE_THRESHOLD = SAMPLE_THRESHOLD / 2;

    if (text.length < SAMPLE_THRESHOLD) {
        result = trimToEndSentence(result);
    } else {
        result = trimToEndSentence(result.slice(0, HALF_SAMPLE_THRESHOLD)) + ' ' + trimToStartSentence(result.slice(-HALF_SAMPLE_THRESHOLD));
    }

    return result.trim();
}

async function getExpressionLabel(text) {
    // Return if text is undefined, saving a costly fetch request
    if ((!modules.includes('classify') && !extension_settings.expressions.local) || !text) {
        return FALLBACK_EXPRESSION;
    }

    text = sampleClassifyText(text);

    try {
        if (extension_settings.expressions.local) {
            // Local transformers pipeline
            const apiResult = await fetch('/api/extra/classify', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ text: text }),
            });

            if (apiResult.ok) {
                const data = await apiResult.json();
                return data.classification[0].label;
            }
        } else {
            // Extras
            const url = new URL(getApiUrl());
            url.pathname = '/api/classify';

            const apiResult = await doExtrasFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'bypass',
                },
                body: JSON.stringify({ text: text }),
            });

            if (apiResult.ok) {
                const data = await apiResult.json();
                return data.classification[0].label;
            }
        }
    } catch (error) {
        console.log(error);
        return FALLBACK_EXPRESSION;
    }
}

function getLastCharacterMessage() {
    const context = getContext();
    const reversedChat = context.chat.slice().reverse();

    for (let mes of reversedChat) {
        if (mes.is_user || mes.is_system) {
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

async function validateImages(character, forceRedrawCached) {
    if (!character) {
        return;
    }

    const labels = await getExpressionsList();

    if (spriteCache[character]) {
        if (forceRedrawCached && $('#image_list').data('name') !== character) {
            console.debug('force redrawing character sprites list');
            drawSpritesList(character, labels, spriteCache[character]);
        }

        return;
    }

    const sprites = await getSpritesList(character);
    let validExpressions = drawSpritesList(character, labels, sprites);
    spriteCache[character] = validExpressions;
}

function drawSpritesList(character, labels, sprites) {
    let validExpressions = [];
    $('#no_chat_expressions').hide();
    $('#open_chat_expressions').show();
    $('#image_list').empty();
    $('#image_list').data('name', character);
    $('#image_list_header_name').text(character);

    if (!Array.isArray(labels)) {
        return [];
    }

    labels.sort().forEach((item) => {
        const sprite = sprites.find(x => x.label == item);
        const isCustom = extension_settings.expressions.custom.includes(item);

        if (sprite) {
            validExpressions.push(sprite);
            $('#image_list').append(getListItem(item, sprite.path, 'success', isCustom));
        }
        else {
            $('#image_list').append(getListItem(item, '/img/No-Image-Placeholder.svg', 'failure', isCustom));
        }
    });
    return validExpressions;
}

/**
 * Renders a list item template for the expressions list.
 * @param {string} item Expression name
 * @param {string} imageSrc Path to image
 * @param {'success' | 'failure'} textClass 'success' or 'failure'
 * @param {boolean} isCustom If expression is added by user
 * @returns {string} Rendered list item template
 */
function getListItem(item, imageSrc, textClass, isCustom) {
    const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    imageSrc = isFirefox ? `${imageSrc}?t=${Date.now()}` : imageSrc;
    return renderExtensionTemplate(MODULE_NAME, 'list-item', { item, imageSrc, textClass, isCustom });
}

async function getSpritesList(name) {
    console.debug('getting sprites list');

    try {
        const result = await fetch(`/api/sprites/get?name=${encodeURIComponent(name)}`);
        let sprites = result.ok ? (await result.json()) : [];
        return sprites;
    }
    catch (err) {
        console.log(err);
        return [];
    }
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

async function getExpressionsList() {
    // Return cached list if available
    if (Array.isArray(expressionsList)) {
        return expressionsList;
    }

    /**
     * Returns the list of expressions from the API or fallback in offline mode.
     * @returns {Promise<string[]>}
     */
    async function resolveExpressionsList() {
        // get something for offline mode (default images)
        if (!modules.includes('classify') && !extension_settings.expressions.local) {
            return DEFAULT_EXPRESSIONS;
        }

        try {
            if (extension_settings.expressions.local) {
                const apiResult = await fetch('/api/extra/classify/labels', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                });

                if (apiResult.ok) {
                    const data = await apiResult.json();
                    expressionsList = data.labels;
                    return expressionsList;
                }
            } else {
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
        }
        catch (error) {
            console.log(error);
            return [];
        }
    }

    const result = await resolveExpressionsList();
    return [...result, ...extension_settings.expressions.custom];
}

async function setExpression(character, expression, force) {
    if (!isTalkingHeadEnabled() || !modules.includes('talkinghead')) {
        console.debug('entered setExpressions');
        await validateImages(character);
        const img = $('img.expression');
        const prevExpressionSrc = img.attr('src');
        const expressionClone = img.clone();

        const sprite = (spriteCache[character] && spriteCache[character].find(x => x.label === expression));
        console.debug('checking for expression images to show..');
        if (sprite) {
            console.debug('setting expression from character images folder');

            if (force && isVisualNovelMode()) {
                const context = getContext();
                const group = context.groups.find(x => x.id === context.groupId);

                for (const member of group.members) {
                    const groupMember = context.characters.find(x => x.avatar === member);

                    if (!groupMember) {
                        continue;
                    }

                    if (groupMember.name == character) {
                        await setImage($(`.expression-holder[data-avatar="${member}"] img`), sprite.path);
                        return;
                    }
                }
            }
            //only swap expressions when necessary
            if (prevExpressionSrc !== sprite.path
                && !img.hasClass('expression-animating')) {
                //clone expression
                expressionClone.addClass('expression-clone');
                //make invisible and remove id to prevent double ids
                //must be made invisible to start because they share the same Z-index
                expressionClone.attr('id', '').css({ opacity: 0 });
                //add new sprite path to clone src
                expressionClone.attr('src', sprite.path);
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
                expressionClone.on('error', function () {
                    console.debug('Expression image error', sprite.path);
                    $(this).attr('src', '');
                    $(this).off('error');
                    if (force && extension_settings.expressions.showDefault) {
                        setDefault();
                    }
                });
            }
        }
        else {
            if (extension_settings.expressions.showDefault) {
                setDefault();
            }
        }

        function setDefault() {
            console.debug('setting default');
            const defImgUrl = `/img/default-expressions/${expression}.png`;
            //console.log(defImgUrl);
            img.attr('src', defImgUrl);
            img.addClass('default');
        }
        document.getElementById('expression-holder').style.display = '';

    } else {
        // Set the Talkinghead emotion to the specified expression
        // TODO: For now, Talkinghead emote only supported when VN mode is off; see also updateVisualNovelMode.
        try {
            let result = await isTalkingHeadAvailable();
            if (result) {
                const url = new URL(getApiUrl());
                url.pathname = '/api/talkinghead/set_emotion';
                await doExtrasFetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ emotion_name: expression }),
                });
            }
        }
        catch (error) {
            // `set_emotion` is not present in old versions, so let it 404.
        }

        try {
            // Find the <img> element with id="expression-image" and class="expression"
            const imgElement = document.querySelector('img#expression-image.expression');
            //console.log("searching");
            if (imgElement && imgElement instanceof HTMLImageElement) {
                //console.log("setting value");
                imgElement.src = getApiUrl() + '/api/talkinghead/result_feed';
            }
        }
        catch (error) {
            //console.log("The fetch failed!");
        }
    }
}

function onClickExpressionImage() {
    const expression = $(this).attr('id');
    setSpriteSlashCommand({}, expression);
}

async function onClickExpressionAddCustom() {
    let expressionName = await callPopup(renderExtensionTemplate(MODULE_NAME, 'add-custom-expression'), 'input');

    if (!expressionName) {
        console.debug('No custom expression name provided');
        return;
    }

    expressionName = expressionName.trim().toLowerCase();

    // a-z, 0-9, dashes and underscores only
    if (!/^[a-z0-9-_]+$/.test(expressionName)) {
        toastr.info('Invalid custom expression name provided');
        return;
    }

    // Check if expression name already exists in default expressions
    if (DEFAULT_EXPRESSIONS.includes(expressionName)) {
        toastr.info('Expression name already exists');
        return;
    }

    // Check if expression name already exists in custom expressions
    if (extension_settings.expressions.custom.includes(expressionName)) {
        toastr.info('Custom expression already exists');
        return;
    }

    // Add custom expression into settings
    extension_settings.expressions.custom.push(expressionName);
    renderCustomExpressions();
    saveSettingsDebounced();

    // Force refresh sprites list
    expressionsList = null;
    spriteCache = {};
    moduleWorker();
}

async function onClickExpressionRemoveCustom() {
    const selectedExpression = $('#expression_custom').val();

    if (!selectedExpression) {
        console.debug('No custom expression selected');
        return;
    }

    const confirmation = await callPopup(renderExtensionTemplate(MODULE_NAME, 'remove-custom-expression', { expression: selectedExpression }), 'confirm');

    if (!confirmation) {
        console.debug('Custom expression removal cancelled');
        return;
    }

    // Remove custom expression from settings
    const index = extension_settings.expressions.custom.indexOf(selectedExpression);
    extension_settings.expressions.custom.splice(index, 1);
    renderCustomExpressions();
    saveSettingsDebounced();

    // Force refresh sprites list
    expressionsList = null;
    spriteCache = {};
    moduleWorker();
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

async function onClickExpressionUpload(event) {
    // Prevents the expression from being set
    event.stopPropagation();

    const id = $(this).closest('.expression_list_item').attr('id');
    const name = $('#image_list').data('name');

    const handleExpressionUploadChange = async (e) => {
        const file = e.target.files[0];

        if (!file) {
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('label', id);
        formData.append('avatar', file);

        await handleFileUpload('/api/sprites/upload', formData);

        // Reset the input
        e.target.form.reset();

        // In Talkinghead mode, when a new talkinghead image is uploaded, refresh the live char.
        if (id === 'talkinghead' && isTalkingHeadEnabled() && modules.includes('talkinghead')) {
            await loadTalkingHead();
        }
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
        $('#visual-novel-wrapper').empty();
        await validateImages(overridePath.length === 0 ? currentLastMessage.name : overridePath, true);
        const expression = await getExpressionLabel(currentLastMessage.mes);
        await sendExpressionCall(overridePath.length === 0 ? currentLastMessage.name : overridePath, expression, true);
        forceUpdateVisualNovelMode();
    } catch (error) {
        console.debug(`Setting expression override for ${avatarFileName} failed with error: ${error}`);
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
        await sendExpressionCall(currentLastMessage.name, expression, true);
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

        const { count } = await handleFileUpload('/api/sprites/upload-zip', formData);
        toastr.success(`Uploaded ${count} image(s) for ${name}`);

        // Reset the input
        e.target.form.reset();

        // In Talkinghead mode, refresh the live char.
        if (isTalkingHeadEnabled() && modules.includes('talkinghead')) {
            await loadTalkingHead();
        }
    };

    $('#expression_upload_pack')
        .off('change')
        .on('change', handleFileUploadChange)
        .trigger('click');
}

async function onClickExpressionDelete(event) {
    // Prevents the expression from being set
    event.stopPropagation();

    const confirmation = await callPopup('<h3>Are you sure?</h3>Once deleted, it\'s gone forever!', 'confirm');

    if (!confirmation) {
        return;
    }

    const id = $(this).closest('.expression_list_item').attr('id');
    const name = $('#image_list').data('name');

    try {
        await fetch('/api/sprites/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name, label: id }),
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

(function () {
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
    function addSettings() {
        $('#extensions_settings').append(renderExtensionTemplate(MODULE_NAME, 'settings'));
        $('#expression_override_button').on('click', onClickExpressionOverrideButton);
        $('#expressions_show_default').on('input', onExpressionsShowDefaultInput);
        $('#expression_upload_pack_button').on('click', onClickExpressionUploadPackButton);
        $('#expressions_show_default').prop('checked', extension_settings.expressions.showDefault).trigger('input');
        $('#expression_local').prop('checked', extension_settings.expressions.local).on('input', function () {
            extension_settings.expressions.local = !!$(this).prop('checked');
            moduleWorker();
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
        $(window).on('resize', updateVisualNovelModeDebounced);
        $('#open_chat_expressions').hide();

        $('#image_type_toggle').on('click', function () {
            if (this instanceof HTMLInputElement) {
                setTalkingHeadState(this.checked);
            }
        });

        renderCustomExpressions();

        $('#expression_custom_add').on('click', onClickExpressionAddCustom);
        $('#expression_custom_remove').on('click', onClickExpressionRemoveCustom);
    }

    // Pause Talkinghead to save resources when the ST tab is not visible or the window is minimized.
    // We currently do this via loading/unloading. Could be improved by adding new pause/unpause endpoints to Extras.
    document.addEventListener('visibilitychange', function (event) {
        let pageIsVisible;
        if (document.hidden) {
            console.debug('expressions: SillyTavern is now hidden');
            pageIsVisible = false;
        } else {
            console.debug('expressions: SillyTavern is now visible');
            pageIsVisible = true;
        }

        if (isTalkingHeadEnabled() && modules.includes('talkinghead')) {
            isTalkingHeadAvailable().then(result => {
                if (result) {
                    if (pageIsVisible) {
                        loadTalkingHead();
                    } else {
                        unloadTalkingHead();
                    }
                    handleImageChange(); // Change image as needed
                } else {
                    //console.log("talkinghead does not exist.");
                }
            });
        }
    });

    addExpressionImage();
    addVisualNovelMode();
    addSettings();
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    const updateFunction = wrapper.update.bind(wrapper);
    setInterval(updateFunction, UPDATE_INTERVAL);
    moduleWorker();
    // For setting the Talkinghead talking animation on/off quickly enough for realtime use, we need another timer on a shorter schedule.
    const wrapperTalkingState = new ModuleWorkerWrapper(updateTalkingState);
    const updateTalkingStateFunction = wrapperTalkingState.update.bind(wrapperTalkingState);
    setInterval(updateTalkingStateFunction, TALKINGCHECK_UPDATE_INTERVAL);
    updateTalkingState();
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

        //set checkbox to global var
        $('#image_type_toggle').prop('checked', extension_settings.expressions.talkinghead);
        if (extension_settings.expressions.talkinghead) {
            setTalkingHeadState(extension_settings.expressions.talkinghead);
        }

        setExpressionOverrideHtml();

        if (isVisualNovelMode()) {
            $('#visual-novel-wrapper').empty();
        }

        updateFunction();
    });
    eventSource.on(event_types.MOVABLE_PANELS_RESET, updateVisualNovelModeDebounced);
    eventSource.on(event_types.GROUP_UPDATED, updateVisualNovelModeDebounced);
    registerSlashCommand('sprite', setSpriteSlashCommand, ['emote'], '<span class="monospace">(spriteId)</span> – force sets the sprite for the current character', true, true);
    registerSlashCommand('spriteoverride', setSpriteSetCommand, ['costume'], '<span class="monospace">(optional folder)</span> – sets an override sprite folder for the current character. If the name starts with a slash or a backslash, selects a sub-folder in the character-named folder. Empty value to reset to default.', true, true);
    registerSlashCommand('lastsprite', (_, value) => lastExpression[value.trim()] ?? '', [], '<span class="monospace">(charName)</span> – Returns the last set sprite / expression for the named character.', true, true);
    registerSlashCommand('th', toggleTalkingHeadCommand, ['talkinghead'], '– Character Expressions: toggles <i>Image Type - talkinghead (extras)</i> on/off.');
})();
