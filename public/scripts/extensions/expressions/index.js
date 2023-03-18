import { getContext, getApiUrl } from "../../extensions.js";
import { urlContentToDataUri } from "../../utils.js";
export { MODULE_NAME };

const MODULE_NAME = 'expressions';
const DEFAULT_KEY = 'extensions_expressions_showDefault';
const UPDATE_INTERVAL = 1000;

let expressionsList = null;
let lastCharacter = undefined;
let lastMessage = null;
let inApiCall = false;
let showDefault = false;

function loadSettings() {
    showDefault = localStorage.getItem(DEFAULT_KEY) == 'true';
    $('#expressions_show_default').prop('checked', showDefault).trigger('input');
}

function saveSettings() {
    localStorage.setItem(DEFAULT_KEY, showDefault.toString());
}

function onExpressionsShowDefaultInput() {
    const value = $(this).prop('checked');
    showDefault = value;
    saveSettings();

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

async function moduleWorker() {
    function getLastCharacterMessage() {
        const reversedChat = context.chat.slice().reverse();

        for (let mes of reversedChat) {
            if (mes.is_user || mes.is_system) {
                continue;
            }

            return mes.mes;
        }

        return '';
    }

    const context = getContext();

    // group chats and non-characters not supported
    if (context.groupId || !context.characterId) {
        removeExpression();
        return;
    }

    // character changed
    if (lastCharacter !== context.characterId) {
        removeExpression();
        validateImages();
    }

    // check if last message changed
    const currentLastMessage = getLastCharacterMessage();
    if (lastCharacter === context.characterId && lastMessage === currentLastMessage) {
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
            body: JSON.stringify({ text: currentLastMessage })
        });

        if (apiResult.ok) {
            const data = await apiResult.json();
            const expression = data.classification[0].label;
            setExpression(context.name2, expression);
        }

    }
    catch (error) {
        console.log(error);
    }
    finally {
        inApiCall = false;
        lastCharacter = context.characterId;
        lastMessage = currentLastMessage;
    }
}

function removeExpression() {
    lastMessage = null;
    $('div.expression').css('background-image', 'unset');
    $('.expression_settings').hide();
}

let imagesValidating = false;

async function validateImages() {
    if (imagesValidating) {
        return;
    }

    imagesValidating = true;
    const context = getContext();
    $('.expression_settings').show();
    $('#image_list').empty();

    if (!context.characterId) {
        return;
    }

    const IMAGE_LIST = (await getExpressionsList()).map(x => `${x}.png`);
    IMAGE_LIST.forEach((item) => {
        const image = document.createElement('img');
        image.src = `/characters/${context.name2}/${item}`;
        image.classList.add('debug-image');
        image.width = '0px';
        image.height = '0px';
        image.onload = function () {
            $('#image_list').append(`<li id="${item}" class="success">${item} - OK</li>`);
        }
        image.onerror = function () {
            $('#image_list').append(`<li id="${item}" class="failure">${item} - Missing</li>`);
        }
        $('#image_list').prepend(image);
    });
    imagesValidating = false;
}

async function getExpressionsList() {
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

async function setExpression(character, expression) {
    const filename = `${expression}.png`;
    const debugImageStatus = document.querySelector(`#image_list li[id="${filename}"]`);

    if (debugImageStatus && !debugImageStatus.classList.contains('failure')) {
        //console.log('setting expression from character images folder');
        const imgUrl = `/characters/${character}/${filename}`;
        $('img.expression').prop('src', imgUrl);
    } else {
        if (showDefault) {
            //console.log('no character images, trying default expressions');
            const defImgUrl = `/img/default-expressions/${filename}`;
            //console.log(defImgUrl);
            $('img.expression').prop('src', defImgUrl);
        }
    }
}

(function () {
    function addExpressionImage() {
        const html = `<div class="expression-holder"><img class="expression"></div>`;
        $('body').append(html);
    }
    function addSettings() {
        const html = `
        <div class="expression_settings">
            <h4>Expression images</h4>
            <ul id="image_list"></ul>
            <p><b>Hint:</b> <i>Create new folder in the <tt>public/characters/</tt> folder and name it as the name of the character. Put PNG images with expressions there.</i></p>
            <label for="expressions_show_default"><input id="expressions_show_default" type="checkbox">Show default images (emojis) if missing</label>
        </div>
        `;
        $('#extensions_settings').append(html);
        $('#expressions_show_default').on('input', onExpressionsShowDefaultInput);
        $('.expression_settings').hide();
    }

    addExpressionImage();
    addSettings();
    loadSettings();
    setInterval(moduleWorker, UPDATE_INTERVAL);
})();