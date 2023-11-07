import { getBase64Async, saveBase64AsFile } from "../../utils.js";
import { getContext, getApiUrl, doExtrasFetch, extension_settings, modules } from "../../extensions.js";
import { callPopup, getRequestHeaders, saveSettingsDebounced, substituteParams } from "../../../script.js";
import { getMessageTimeStamp } from "../../RossAscends-mods.js";
import { SECRET_KEYS, secret_state } from "../../secrets.js";
export { MODULE_NAME };

const MODULE_NAME = 'caption';
const UPDATE_INTERVAL = 1000;

const PROMPT_DEFAULT = 'What’s in this image?';
const TEMPLATE_DEFAULT = '[{{user}} sends {{char}} a picture that contains: {{caption}}]';

async function moduleWorker() {
    const hasConnection = getContext().onlineStatus !== 'no_connection';
    $('#send_picture').toggle(hasConnection);
}

function migrateSettings() {
    if (extension_settings.caption.local !== undefined) {
        extension_settings.caption.source = extension_settings.caption.local ? 'local' : 'extras';
    }

    delete extension_settings.caption.local;

    if (!extension_settings.caption.source) {
        extension_settings.caption.source = 'extras';
    }

    if (!extension_settings.caption.prompt) {
        extension_settings.caption.prompt = PROMPT_DEFAULT;
    }

    if (!extension_settings.caption.template) {
        extension_settings.caption.template = TEMPLATE_DEFAULT;
    }
}

async function setImageIcon() {
    try {
        const sendButton = $('#send_picture .extensionsMenuExtensionButton');
        sendButton.addClass('fa-image');
        sendButton.removeClass('fa-hourglass-half');
    }
    catch (error) {
        console.log(error);
    }
}

async function setSpinnerIcon() {
    try {
        const sendButton = $('#send_picture .extensionsMenuExtensionButton');
        sendButton.removeClass('fa-image');
        sendButton.addClass('fa-hourglass-half');
    }
    catch (error) {
        console.log(error);
    }
}

async function sendCaptionedMessage(caption, image) {
    const context = getContext();
    let template = extension_settings.caption.template || TEMPLATE_DEFAULT;

    if (!/{{caption}}/i.test(template)) {
        console.warn('Poka-yoke: Caption template does not contain {{caption}}. Appending it.')
        template += ' {{caption}}';
    }

    let messageText = substituteParams(template).replace(/{{caption}}/i, caption);

    if (extension_settings.caption.refine_mode) {
        messageText = await callPopup(
            '<h3>Review and edit the generated message:</h3>Press "Cancel" to abort the caption sending.',
            'input',
            messageText,
            { rows: 5, okButton: 'Send' });

        if (!messageText) {
            throw new Error('User aborted the caption sending.');
        }
    }

    const message = {
        name: context.name1,
        is_user: true,
        send_date: getMessageTimeStamp(),
        mes: messageText,
        extra: {
            image: image,
            title: messageText,
        },
    };
    context.chat.push(message);
    context.addOneMessage(message);
    await context.generate('caption');
}

/**
 *
 * @param {string} base64Img Base64 encoded image without the data:image/...;base64, prefix
 * @param {string} fileData Base64 encoded image with the data:image/...;base64, prefix
 * @returns
 */
async function doCaptionRequest(base64Img, fileData) {
    switch (extension_settings.caption.source) {
        case 'local':
            return await captionLocal(base64Img);
        case 'extras':
            return await captionExtras(base64Img);
        case 'horde':
            return await captionHorde(base64Img);
        case 'openai':
            return await captionOpenAI(fileData);
        default:
            throw new Error('Unknown caption source.');
    }
}

async function captionExtras(base64Img) {
    if (!modules.includes('caption')) {
        throw new Error('No captioning module is available.');
    }

    const url = new URL(getApiUrl());
    url.pathname = '/api/caption';

    const apiResult = await doExtrasFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Bypass-Tunnel-Reminder': 'bypass',
        },
        body: JSON.stringify({ image: base64Img })
    });

    if (!apiResult.ok) {
        throw new Error('Failed to caption image via Extras.');
    }

    const data = await apiResult.json();
    return data;
}

async function captionLocal(base64Img) {
    const apiResult = await fetch('/api/extra/caption', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ image: base64Img })
    });

    if (!apiResult.ok) {
        throw new Error('Failed to caption image via local pipeline.');
    }

    const data = await apiResult.json();
    return data;
}

async function captionHorde(base64Img) {
    const apiResult = await fetch('/api/horde/caption-image', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ image: base64Img })
    });

    if (!apiResult.ok) {
        throw new Error('Failed to caption image via Horde.');
    }

    const data = await apiResult.json();
    return data;
}

async function captionOpenAI(base64Img) {
    const prompt = extension_settings.caption.prompt || PROMPT_DEFAULT;
    const apiResult = await fetch('/api/openai/caption-image', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ image: base64Img, prompt: prompt }),
    });

    if (!apiResult.ok) {
        throw new Error('Failed to caption image via OpenAI.');
    }

    const data = await apiResult.json();
    return data;
}

async function onSelectImage(e) {
    setSpinnerIcon();
    const file = e.target.files[0];

    if (!file || !(file instanceof File)) {
        return;
    }

    try {
        const context = getContext();
        const fileData = await getBase64Async(file);
        const base64Format = fileData.split(',')[0].split(';')[0].split('/')[1];
        const base64Data = fileData.split(',')[1];
        const data = await doCaptionRequest(base64Data, fileData);
        const caption = data.caption;
        const imageToSave = data.thumbnail ? data.thumbnail : base64Data;
        const format = data.thumbnail ? 'jpeg' : base64Format;
        const imagePath = await saveBase64AsFile(imageToSave, context.name2, '', format);
        await sendCaptionedMessage(caption, imagePath);
    }
    catch (error) {
        toastr.error('Failed to caption image.');
        console.log(error);
    }
    finally {
        e.target.form.reset();
        setImageIcon();
    }
}

function onRefineModeInput() {
    extension_settings.caption.refine_mode = $('#caption_refine_mode').prop('checked');
    saveSettingsDebounced();
}

jQuery(function () {
    function addSendPictureButton() {
        const sendButton = $(`
        <div id="send_picture" class="list-group-item flex-container flexGap5">
            <div class="fa-solid fa-image extensionsMenuExtensionButton"></div>
            Send a Picture
        </div>`);

        $('#extensionsMenu').prepend(sendButton);
        $(sendButton).hide();
        $(sendButton).on('click', () => {
            const hasCaptionModule =
                (modules.includes('caption') && extension_settings.caption.source === 'extras') ||
                (extension_settings.caption.source === 'openai' && secret_state[SECRET_KEYS.OPENAI]) ||
                extension_settings.caption.source === 'local' ||
                extension_settings.caption.source === 'horde';

            if (!hasCaptionModule) {
                toastr.error('No captioning module is available. Choose other captioning source in the extension settings.');
                return;
            }

            $('#img_file').trigger('click');
        });
    }
    function addPictureSendForm() {
        const inputHtml = `<input id="img_file" type="file" accept="image/*">`;
        const imgForm = document.createElement('form');
        imgForm.id = 'img_form';
        $(imgForm).append(inputHtml);
        $(imgForm).hide();
        $('#form_sheld').append(imgForm);
        $('#img_file').on('change', onSelectImage);
    }
    function addSettings() {
        const html = `
        <div class="caption_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Image Captioning</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label for="caption_source">Source:</label>
                    <select id="caption_source" class="text_pole">
                        <option value="local">Local</option>
                        <option value="extras">Extras</option>
                        <option value="horde">Horde</option>
                        <option value="openai">OpenAI</option>
                    </select>
                    <label for="caption_prompt">Caption Prompt (OpenAI):</label>
                    <textarea id="caption_prompt" class="text_pole" rows="1" placeholder="&lt; Use default &gt;">${PROMPT_DEFAULT}</textarea>
                    <label for="caption_template">Message Template: <small>(use <tt>{{caption}}</tt> macro)</small></label>
                    <textarea id="caption_template" class="text_pole" rows="2" placeholder="&lt; Use default &gt;">${TEMPLATE_DEFAULT}</textarea>
                    <label class="checkbox_label margin-bot-10px" for="caption_refine_mode">
                        <input id="caption_refine_mode" type="checkbox" class="checkbox">
                        Edit captions before generation
                    </label>
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings2').append(html);
    }

    addSettings();
    addPictureSendForm();
    addSendPictureButton();
    setImageIcon();
    migrateSettings();
    moduleWorker();

    $('#caption_refine_mode').prop('checked', !!(extension_settings.caption.refine_mode));
    $('#caption_source').val(extension_settings.caption.source);
    $('#caption_prompt').val(extension_settings.caption.prompt);
    $('#caption_template').val(extension_settings.caption.template);
    $('#caption_refine_mode').on('input', onRefineModeInput);
    $('#caption_source').on('change', () => {
        extension_settings.caption.source = String($('#caption_source').val());
        saveSettingsDebounced();
    });
    $('#caption_prompt').on('input', () => {
        extension_settings.caption.prompt = String($('#caption_prompt').val());
        saveSettingsDebounced();
    });
    $('#caption_template').on('input', () => {
        extension_settings.caption.template = String($('#caption_template').val());
        saveSettingsDebounced();
    });
    setInterval(moduleWorker, UPDATE_INTERVAL);
});
