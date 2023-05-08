import { saveSettingsDebounced } from "../../../script.js";
import { getContext, getApiUrl, modules, extension_settings } from "../../extensions.js";
export { MODULE_NAME };

const MODULE_NAME = 'expressions';
const UPDATE_INTERVAL = 2000;
const DEFAULT_EXPRESSIONS = [
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

let isWorkerBusy = false;

async function moduleWorkerWrapper() {
    // Don't touch me I'm busy...
    if (isWorkerBusy) {
        return;
    }

    // I'm free. Let's update!
    try {
        isWorkerBusy = true;
        await moduleWorker();
    }
    finally {
        isWorkerBusy = false;
    }
}

async function moduleWorker() {
    const context = getContext();

    // non-characters not supported
    if (!context.groupId && context.characterId === undefined) {
        removeExpression();
        return;
    }

    // character changed
    if (context.groupId !== lastCharacter && context.characterId !== lastCharacter) {
        removeExpression();
        spriteCache = {};
    }

    const currentLastMessage = getLastCharacterMessage();

    // character has no expressions or it is not loaded
    if (Object.keys(spriteCache).length === 0) {
        await validateImages(currentLastMessage.name);
        lastCharacter = context.groupId || context.characterId;
    }

    const offlineMode = $('.expression_settings .offline_mode');
    if (!modules.includes('classify')) {
        $('.expression_settings').show();
        offlineMode.css('display', 'block');
        lastCharacter = context.groupId || context.characterId;

        if (context.groupId) {
            await validateImages(currentLastMessage.name, true);
        }

        return;
    }
    else {
        // force reload expressions list on connect to API
        if (offlineMode.is(':visible')) {
            expressionsList = null;
            spriteCache = {};
            expressionsList = await getExpressionsList();
            await validateImages(currentLastMessage.name, true);
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
        const url = new URL(getApiUrl());
        url.pathname = '/api/classify';

        const apiResult = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'bypass',
            },
            body: JSON.stringify({ text: currentLastMessage.mes })
        });

        if (apiResult.ok) {
            const name = context.groupId ? currentLastMessage.name : context.name2;
            const force = !!context.groupId;
            const data = await apiResult.json();
            let expression = data.classification[0].label;

            // Character won't be angry on you for swiping
            if (currentLastMessage.mes == '...' && expressionsList.includes('joy')) {
                expression = 'joy';
            }

            setExpression(name, expression, force);
        }

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

function getLastCharacterMessage() {
    const context = getContext();
    const reversedChat = context.chat.slice().reverse();

    for (let mes of reversedChat) {
        if (mes.is_user || mes.is_system) {
            continue;
        }

        return { mes: mes.mes, name: mes.name };
    }

    return { mes: '', name: null };
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
            console.log('force redrawing character sprites list')
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
    return `
        <div id="${item}" class="expression_list_item">
            <span class="expression_list_title ${textClass}">${item}</span>
            <img class="expression_list_image" src="${imageSrc}" />
        </div>
    `;
}

async function getSpritesList(name) {
    console.log('getting sprites list');

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
        const apiResult = await fetch(url, {
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
    console.log('entered setExpressions');
    await validateImages(character);
    const img = $('img.expression');

    const sprite = (spriteCache[character] && spriteCache[character].find(x => x.label === expression));
    console.log('checking for expression images to show..');
    if (sprite) {
        console.log('setting expression from character images folder');
        img.attr('src', sprite.path);
        img.removeClass('default');
        img.off('error');
        img.on('error', function () {
            $(this).attr('src', '');
            if (force && extension_settings.expressions.showDefault) {
                setDefault();
            }
        });
    } else {
        if (extension_settings.expressions.showDefault) {
            setDefault();
        }
    }

    function setDefault() {
        console.log('setting default');
        const defImgUrl = `/img/default-expressions/${expression}.png`;
        //console.log(defImgUrl);
        img.attr('src', defImgUrl);
        img.addClass('default');
    }
    document.getElementById("expression-holder").style.display = '';
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
    }
    function addSettings() {

        const html = `
        <div class="expression_settings">
            <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Expression images</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <p class="offline_mode">You are in offline mode. Click on the image below to set the expression.</p>
                <div id="image_list"></div>
                <p class="hint"><b>Hint:</b> <i>Create new folder in the <b>public/characters/</b> folder and name it as the name of the character.
                Put images with expressions there. File names should follow the pattern: <tt>[expression_label].[image_format]</tt></i></p>
                <label for="expressions_show_default"><input id="expressions_show_default" type="checkbox">Show default images (emojis) if missing</label>
            </div>
            </div>
        </div>
        `;
        $('#extensions_settings').append(html);
        $('#expressions_show_default').on('input', onExpressionsShowDefaultInput);
        $('#expressions_show_default').prop('checked', extension_settings.expressions.showDefault).trigger('input');
        $(document).on('click', '.expression_list_item', onClickExpressionImage);
        $('.expression_settings').hide();
    }

    addExpressionImage();
    addSettings();
    setInterval(moduleWorkerWrapper, UPDATE_INTERVAL);
    moduleWorkerWrapper();
})();