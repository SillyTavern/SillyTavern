import { callPopup, eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from "../../../script.js";
import { dragElement, isMobile } from "../../RossAscends-mods.js";
import { getContext, getApiUrl, modules, extension_settings, ModuleWorkerWrapper, doExtrasFetch, renderExtensionTemplate } from "../../extensions.js";
import { loadMovingUIState, power_user } from "../../power-user.js";
import { onlyUnique, debounce, getCharaFilename } from "../../utils.js";
export { MODULE_NAME };

const MODULE_NAME = 'expressions';
const UPDATE_INTERVAL = 2000;
const FALLBACK_EXPRESSION = 'joy';
const DEFAULT_EXPRESSIONS = [
    "talkinghead",
    "admiration",
    "amusement",
    "anger",
    "annoyance",
    "approval",
    "caring",
    "confusion",
    "curiosity",
    "desire",
    "disappointment",
    "disapproval",
    "disgust",
    "embarrassment",
    "excitement",
    "fear",
    "gratitude",
    "grief",
    "joy",
    "love",
    "nervousness",
    "optimism",
    "pride",
    "realization",
    "relief",
    "remorse",
    "sadness",
    "surprise",
    "neutral"
];

let expressionsList = null;
let lastCharacter = undefined;
let lastMessage = null;
let spriteCache = {};
let inApiCall = false;

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
        if (isDisabled) {
            continue;
        }

        const character = context.characters.find(x => x.avatar == avatar);

        if (!character) {
            continue;
        }

        let spriteFolderName = character.name;
        const avatarFileName = getSpriteFolderName({ original_avatar: character.avatar });
        const expressionOverride = extension_settings.expressionOverrides.find((e) =>
            e.name == avatarFileName
        );

        if (expressionOverride && expressionOverride.path) {
            spriteFolderName = expressionOverride.path;
        }

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

    let images = $('.expression-holder');
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
        const elementID = element.attr('id')

        // skip repositioning of dragged elements
        if (element.data('dragged')
            || (power_user.movingUIState[elementID]
                && (typeof power_user.movingUIState[elementID] === 'object')
                && Object.keys(power_user.movingUIState[elementID]).length > 0)) {
            loadMovingUIState()
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
        let spriteFolderName = lastMessage.name;
        const avatarFileName = getSpriteFolderName(lastMessage);
        const expressionOverride = extension_settings.expressionOverrides.find((e) =>
            e.name == avatarFileName
        );

        if (expressionOverride && expressionOverride.path) {
            spriteFolderName = expressionOverride.path;
        }

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
            expressionClone.addClass('expression-clone')
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
                opacity: 0
            }).animate({
                opacity: 1
            }, duration)
                //when finshed fading in clone, fade out the original
                .promise().done(function () {
                    img.animate({
                        opacity: 0
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
                console.debug('Expression image error', sprite.path);
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

async function unloadLiveChar() {
    if (!modules.includes('talkinghead')) {
        console.debug('talkinghead module is disabled');
        return;
    }

    try {
        const url = new URL(getApiUrl());
        url.pathname = '/api/talkinghead/unload';
        const loadResponse = await doExtrasFetch(url);
        if (!loadResponse.ok) {
            throw new Error(loadResponse.statusText);
        }
        const loadResponseText = await loadResponse.text();
        //console.log(`Response: ${loadResponseText}`);
    } catch (error) {
        //console.error(`Error unloading - ${error}`);
    }
}

async function loadLiveChar() {
    if (!modules.includes('talkinghead')) {
        console.debug('talkinghead module is disabled');
        return;
    }

    const context = getContext();
    let spriteFolderName = context.name2;
    const message = getLastCharacterMessage();
    const avatarFileName = getSpriteFolderName(message);
    const expressionOverride = extension_settings.expressionOverrides.find((e) =>
        e.name == avatarFileName
    );

    if (expressionOverride && expressionOverride.path) {
        spriteFolderName = expressionOverride.path;
    }

    const talkingheadPath = `/characters/${encodeURIComponent(spriteFolderName)}/talkinghead.png`;

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

    } catch (error) {
        console.error(`Error loading talkinghead image: ${talkingheadPath} - ${error}`);
    }
}

function handleImageChange() {
    const imgElement = document.querySelector('img#expression-image.expression');

    if (!imgElement) {
        console.log("Cannot find addExpressionImage()");
        return;
    }

    if (extension_settings.expressions.talkinghead) {
        // Method get IP of endpoint
        const talkingheadResultFeedSrc = `${getApiUrl()}/api/talkinghead/result_feed`;
        $('#expression-holder').css({ display: '' });
        if (imgElement.src !== talkingheadResultFeedSrc) {
            const expressionImageElement = document.querySelector('.expression_list_image');

            if (expressionImageElement) {
                doExtrasFetch(expressionImageElement.src, {
                    method: 'HEAD',
                })
                    .then(response => {
                        if (response.ok) {
                            imgElement.src = talkingheadResultFeedSrc;
                        }
                    })
                    .catch(error => {
                        console.error(error); // Log the error if necessary
                    });
            }
        }
    } else {
        imgElement.src = ""; //remove incase char doesnt have expressions
        setExpression(getContext().name2, FALLBACK_EXPRESSION, true);
    }
}

async function moduleWorker() {
    const context = getContext();

    // non-characters not supported
    if (!context.groupId && (context.characterId === undefined || context.characterId === 'invalid-safety-id')) {
        removeExpression();
        return;
    }

    // character changed
    if (context.groupId !== lastCharacter && context.characterId !== lastCharacter) {
        removeExpression();
        spriteCache = {};

        //clear expression
        let imgElement = document.getElementById('expression-image');
        imgElement.src = "";

        //set checkbox to global var
        $('#image_type_toggle').prop('checked', extension_settings.expressions.talkinghead);
        if (extension_settings.expressions.talkinghead) {
            settalkingheadState(extension_settings.expressions.talkinghead);
        }
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
        $("#expression-holder").css({ top: '', left: '', right: '', bottom: '', height: '', width: '', margin: '' });
    }

    const currentLastMessage = getLastCharacterMessage();
    let spriteFolderName = currentLastMessage.name;
    const avatarFileName = getSpriteFolderName(currentLastMessage);
    const expressionOverride = extension_settings.expressionOverrides.find((e) =>
        e.name == avatarFileName
    );

    if (expressionOverride && expressionOverride.path) {
        spriteFolderName = expressionOverride.path;
    }

    // character has no expressions or it is not loaded
    if (Object.keys(spriteCache).length === 0) {
        await validateImages(spriteFolderName);
        lastCharacter = context.groupId || context.characterId;
    }

    const offlineMode = $('.expression_settings .offline_mode');
    if (!modules.includes('classify')) {
        $('.expression_settings').show();
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

        offlineMode.css('display', 'none');
    }

    // check if last message changed
    if ((lastCharacter === context.characterId || lastCharacter === context.groupId)
        && lastMessage === currentLastMessage.mes) {
        return;
    }

    // API is busy
    if (inApiCall) {
        return;
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
    }
}

async function talkingheadcheck() {
    const context = getContext();
    let spriteFolderName = context.name2;
    const message = getLastCharacterMessage();
    const avatarFileName = getSpriteFolderName(message);
    const expressionOverride = extension_settings.expressionOverrides.find((e) =>
        e.name == avatarFileName
    );

    if (expressionOverride && expressionOverride.path) {
        spriteFolderName = expressionOverride.path;
    }

    try {
        await validateImages(spriteFolderName);

        let talkingheadObj = spriteCache[spriteFolderName].find(obj => obj.label === 'talkinghead');
        let talkingheadPath_f = talkingheadObj ? talkingheadObj.path : null;

        if (talkingheadPath_f != null) {
            //console.log("talkingheadPath_f " + talkingheadPath_f);
            return true;
        } else {
            //console.log("talkingheadPath_f is null");
            unloadLiveChar();
            return false;
        }
    } catch (err) {
        return err;
    }
}

function settalkingheadState(switch_var) {
    extension_settings.expressions.talkinghead = switch_var; // Store setting
    saveSettingsDebounced();

    talkingheadcheck().then(result => {
        if (result) {
            //console.log("talkinghead exists!");

            if (extension_settings.expressions.talkinghead) {
                loadLiveChar();
            } else {
                unloadLiveChar();
            }
            handleImageChange(switch_var); // Change image as needed


        } else {
            //console.log("talkinghead does not exist.");
        }
    });
}

function getSpriteFolderName(message) {
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

    const folderName = avatarPath.replace(/\.[^/.]+$/, "");
    return folderName;
}

async function sendExpressionCall(name, expression, force, vnMode) {
    if (!vnMode) {
        vnMode = isVisualNovelMode();
    }

    if (vnMode) {
        await updateVisualNovelMode(name, expression);
    } else {
        setExpression(name, expression, force);
    }
}

async function getExpressionLabel(text) {
    // Return if text is undefined, saving a costly fetch request
    if (!modules.includes('classify') || !text) {
        return FALLBACK_EXPRESSION;
    }

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
    $('.expression_settings').hide();
}

async function validateImages(character, forceRedrawCached) {
    if (!character) {
        return;
    }

    const labels = await getExpressionsList();

    if (spriteCache[character]) {
        if (forceRedrawCached && $('#image_list').data('name') !== character) {
            console.debug('force redrawing character sprites list')
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
    $('.expression_settings').show();
    $('#image_list').empty();
    $('#image_list').data('name', character);

    if (!Array.isArray(labels)) {
        return [];
    }

    labels.sort().forEach((item) => {
        const sprite = sprites.find(x => x.label == item);

        if (sprite) {
            validExpressions.push(sprite);
            $('#image_list').append(getListItem(item, sprite.path, 'success'));
        }
        else {
            $('#image_list').append(getListItem(item, '/img/No-Image-Placeholder.svg', 'failure'));
        }
    });
    return validExpressions;
}

function getListItem(item, imageSrc, textClass) {
    return renderExtensionTemplate(MODULE_NAME, 'list-item', { item, imageSrc, textClass });
}

async function getSpritesList(name) {
    console.debug('getting sprites list');

    try {
        const result = await fetch(`/get_sprites?name=${encodeURIComponent(name)}`);
        let sprites = result.ok ? (await result.json()) : [];
        return sprites;
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

async function getExpressionsList() {
    // get something for offline mode (default images)
    if (!modules.includes('classify')) {
        return DEFAULT_EXPRESSIONS;
    }

    if (Array.isArray(expressionsList)) {
        return expressionsList;
    }

    const url = new URL(getApiUrl());
    url.pathname = '/api/classify/labels';

    try {
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
    catch (error) {
        console.log(error);
        return [];
    }
}

async function setExpression(character, expression, force) {
    if (!extension_settings.expressions.talkinghead) {
        console.debug('entered setExpressions');
        await validateImages(character);
        const img = $('img.expression');
        const prevExpressionSrc = img.attr('src');
        const expressionClone = img.clone()

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
                expressionClone.addClass('expression-clone')
                //make invisible and remove id to prevent double ids
                //must be made invisible to start because they share the same Z-index
                expressionClone.attr('id', '').css({ opacity: 0 });
                //add new sprite path to clone src
                expressionClone.attr('src', sprite.path);
                //add invisible clone to html
                expressionClone.appendTo($("#expression-holder"))

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
                    opacity: 0
                }).animate({
                    opacity: 1
                }, duration)
                    //when finshed fading in clone, fade out the original
                    .promise().done(function () {
                        img.animate({
                            opacity: 0
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
        document.getElementById("expression-holder").style.display = '';

    } else {


        talkingheadcheck().then(result => {
            if (result) {
                // Find the <img> element with id="expression-image" and class="expression"
                const imgElement = document.querySelector('img#expression-image.expression');
                //console.log("searching");
                if (imgElement) {
                    //console.log("setting value");
                    imgElement.src = getApiUrl() + '/api/talkinghead/result_feed';
                }

            } else {
                //console.log("The fetch failed!");
            }
        });


    }
}

function onClickExpressionImage() {
    // online mode doesn't need force set
    if (modules.includes('classify')) {
        return;
    }

    const expression = $(this).attr('id');
    const name = getLastCharacterMessage().name;

    if ($(this).find('.failure').length === 0) {
        setExpression(name, expression, true);
    }
}
async function handleFileUpload(url, formData) {
    try {
        const data = await jQuery.ajax({
            type: "POST",
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

        await handleFileUpload('/upload_sprite', formData);

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
    const avatarFileName = getSpriteFolderName(currentLastMessage);

    // If the avatar name couldn't be found, abort.
    if (!avatarFileName) {
        console.debug(`Could not find filename for character with name ${currentLastMessage.name} and ID ${context.characterId}`);

        return;
    }

    const overridePath = $("#expression_override").val();
    const existingOverrideIndex = extension_settings.expressionOverrides.findIndex((e) =>
        e.name == avatarFileName
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

    console.debug("All expression image overrides have been cleared.");

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

        const { count } = await handleFileUpload('/upload_sprite_pack', formData);
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

    const confirmation = await callPopup("<h3>Are you sure?</h3>Once deleted, it's gone forever!", 'confirm');

    if (!confirmation) {
        return;
    }

    const id = $(this).closest('.expression_list_item').attr('id');
    const name = $('#image_list').data('name');

    try {
        await fetch('/delete_sprite', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name, label: id }),
        });
    } catch (error) {
        toastr.error('Failed to delete image. Try again later.');
    }

    // Refresh sprites list
    delete spriteCache[name];
    await validateImages(name);
}

function setExpressionOverrideHtml(forceClear = false) {
    const currentLastMessage = getLastCharacterMessage();
    const avatarFileName = getSpriteFolderName(currentLastMessage);
    if (!avatarFileName) {
        return;
    }

    const expressionOverride = extension_settings.expressionOverrides.find((e) =>
        e.name == avatarFileName
    );

    if (expressionOverride && expressionOverride.path) {
        $("#expression_override").val(expressionOverride.path);
    } else if (expressionOverride) {
        delete extension_settings.expressionOverrides[expressionOverride.name];
    }

    if (forceClear && !expressionOverride) {
        $("#expression_override").val("");
    }
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
        </div>`
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
        $('#expression_override_cleanup_button').on('click', onClickExpressionOverrideRemoveAllButton);
        $(document).on('dragstart', '.expression', (e) => {
            e.preventDefault()
            return false
        })
        $(document).on('click', '.expression_list_item', onClickExpressionImage);
        $(document).on('click', '.expression_list_upload', onClickExpressionUpload);
        $(document).on('click', '.expression_list_delete', onClickExpressionDelete);
        $(window).on("resize", updateVisualNovelModeDebounced);
        $('.expression_settings').hide();

        $('#image_type_toggle').on('click', function () {
            settalkingheadState(this.checked);
        });
    }

    addExpressionImage();
    addVisualNovelMode();
    addSettings();
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    const updateFunction = wrapper.update.bind(wrapper);
    setInterval(updateFunction, UPDATE_INTERVAL);
    moduleWorker();
    dragElement($("#expression-holder"))
    eventSource.on(event_types.CHAT_CHANGED, () => {
        setExpressionOverrideHtml();

        if (isVisualNovelMode()) {
            $('#visual-novel-wrapper').empty();
        }
    });
    eventSource.on(event_types.MOVABLE_PANELS_RESET, updateVisualNovelModeDebounced);
    eventSource.on(event_types.GROUP_UPDATED, updateVisualNovelModeDebounced);
})();
