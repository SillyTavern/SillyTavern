import { Fuse, localforage } from '../lib.js';
import { chat_metadata, eventSource, event_types, generateQuietPrompt, getCurrentChatId, getRequestHeaders, getThumbnailUrl, saveSettingsDebounced } from '../script.js';
import { openThirdPartyExtensionMenu, saveMetadataDebounced } from './extensions.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { createThumbnail, flashHighlight, getBase64Async, stringFormat } from './utils.js';
import { t } from './i18n.js';
import { Popup } from './popup.js';

const BG_METADATA_KEY = 'custom_background';
const LIST_METADATA_KEY = 'chat_backgrounds';

// A single transparent PNG pixel used as a placeholder for errored backgrounds
const PNG_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PNG_PIXEL_BLOB = new Blob([Uint8Array.from(atob(PNG_PIXEL), c => c.charCodeAt(0))], { type: 'image/png' });
const PLACEHOLDER_IMAGE = `url('data:image/png;base64,${PNG_PIXEL}')`;

/**
 * Storage for frontend-generated background thumbnails.
 * This is used to store thumbnails for backgrounds that cannot be generated on the server.
 */
const THUMBNAIL_STORAGE = localforage.createInstance({ name: 'SillyTavern_Thumbnails' });

/**
 * Cache for thumbnail blob URLs.
 * @type {Map<string, string>}
 */
const THUMBNAIL_BLOBS = new Map();

const THUMBNAIL_CONFIG = {
    width: 160,
    height: 90,
};

/**
 * Global IntersectionObserver instance for lazy loading backgrounds
 * @type {IntersectionObserver|null}
 */
let lazyLoadObserver = null;

export let background_settings = {
    name: '__transparent.png',
    url: generateUrlParameter('__transparent.png', false),
    fitting: 'classic',
    animation: false,
};

export function loadBackgroundSettings(settings) {
    let backgroundSettings = settings.background;
    if (!backgroundSettings || !backgroundSettings.name || !backgroundSettings.url) {
        backgroundSettings = background_settings;
    }
    if (!backgroundSettings.fitting) {
        backgroundSettings.fitting = 'classic';
    }
    if (!Object.hasOwn(backgroundSettings, 'animation')) {
        backgroundSettings.animation = false;
    }
    setBackground(backgroundSettings.name, backgroundSettings.url);
    setFittingClass(backgroundSettings.fitting);
    $('#background_fitting').val(backgroundSettings.fitting);
    $('#background_thumbnails_animation').prop('checked', background_settings.animation);
}

/**
 * Sets the background for the current chat and adds it to the list of custom backgrounds.
 * @param {{url: string, path:string}} backgroundInfo
 */
async function forceSetBackground(backgroundInfo) {
    saveBackgroundMetadata(backgroundInfo.url);
    setCustomBackground();

    const list = chat_metadata[LIST_METADATA_KEY] || [];
    const bg = backgroundInfo.path;
    list.push(bg);
    chat_metadata[LIST_METADATA_KEY] = list;
    saveMetadataDebounced();
    await getChatBackgroundsList();
    highlightNewBackground(bg);
    highlightLockedBackground();
}

async function onChatChanged() {
    if (hasCustomBackground()) {
        setCustomBackground();
    }
    else {
        unsetCustomBackground();
    }

    await getChatBackgroundsList();
    highlightLockedBackground();
}

async function getChatBackgroundsList() {
    const list = chat_metadata[LIST_METADATA_KEY];
    const listEmpty = !Array.isArray(list) || list.length === 0;

    $('#bg_custom_content').empty();
    $('#bg_chat_hint').toggle(listEmpty);

    if (listEmpty) {
        return;
    }

    for (const bg of list) {
        const template = await getBackgroundFromTemplate(bg, true);
        $('#bg_custom_content').append(template);
    }
    activateLazyLoader();
}

function getBackgroundPath(fileUrl) {
    return `backgrounds/${encodeURIComponent(fileUrl)}`;
}

function highlightLockedBackground() {
    $('.bg_example').removeClass('locked');

    const lockedBackground = chat_metadata[BG_METADATA_KEY];

    if (!lockedBackground) {
        return;
    }

    $('.bg_example').each(function () {
        const url = $(this).data('url');
        if (url === lockedBackground) {
            $(this).addClass('locked');
        }
    });
}

/**
 * Locks the background for the current chat
 * @param {Event} e Click event
 * @returns {string} Empty string
 */
function onLockBackgroundClick(e) {
    e?.stopPropagation();

    const chatName = getCurrentChatId();

    if (!chatName) {
        toastr.warning('Select a chat to lock the background for it');
        return '';
    }

    const relativeBgImage = getUrlParameter(this) ?? background_settings.url;

    saveBackgroundMetadata(relativeBgImage);
    setCustomBackground();
    highlightLockedBackground();
    return '';
}

/**
 * Locks the background for the current chat
 * @param {Event} e Click event
 * @returns {string} Empty string
 */
function onUnlockBackgroundClick(e) {
    e?.stopPropagation();
    removeBackgroundMetadata();
    unsetCustomBackground();
    highlightLockedBackground();
    return '';
}

function hasCustomBackground() {
    return chat_metadata[BG_METADATA_KEY];
}

function saveBackgroundMetadata(file) {
    chat_metadata[BG_METADATA_KEY] = file;
    saveMetadataDebounced();
}

function removeBackgroundMetadata() {
    delete chat_metadata[BG_METADATA_KEY];
    saveMetadataDebounced();
}

function setCustomBackground() {
    const file = chat_metadata[BG_METADATA_KEY];

    // bg already set
    if (document.getElementById('bg_custom').style.backgroundImage == file) {
        return;
    }

    $('#bg_custom').css('background-image', file);
}

function unsetCustomBackground() {
    $('#bg_custom').css('background-image', 'none');
}

function onSelectBackgroundClick() {
    const isCustom = $(this).attr('custom') === 'true';
    const relativeBgImage = getUrlParameter(this);

    // if clicked on upload button
    if (!relativeBgImage) {
        return;
    }

    // Automatically lock the background if it's custom or other background is locked
    if (hasCustomBackground() || isCustom) {
        saveBackgroundMetadata(relativeBgImage);
        setCustomBackground();
        highlightLockedBackground();
    }
    highlightLockedBackground();

    const customBg = window.getComputedStyle(document.getElementById('bg_custom')).backgroundImage;

    // Custom background is set. Do not override the layer below
    if (customBg !== 'none') {
        return;
    }

    const bgFile = $(this).attr('bgfile');
    const backgroundUrl = getBackgroundPath(bgFile);

    // Fetching to browser memory to reduce flicker
    fetch(backgroundUrl).then(() => {
        setBackground(bgFile, relativeBgImage);
    }).catch(() => {
        console.log('Background could not be set: ' + backgroundUrl);
    });
}

async function onCopyToSystemBackgroundClick(e) {
    e.stopPropagation();
    const bgNames = await getNewBackgroundName(this);

    if (!bgNames) {
        return;
    }

    const bgFile = await fetch(bgNames.oldBg);

    if (!bgFile.ok) {
        toastr.warning('Failed to copy background');
        return;
    }

    const blob = await bgFile.blob();
    const file = new File([blob], bgNames.newBg);
    const formData = new FormData();
    formData.set('avatar', file);

    await uploadBackground(formData);

    const list = chat_metadata[LIST_METADATA_KEY] || [];
    const index = list.indexOf(bgNames.oldBg);
    list.splice(index, 1);
    saveMetadataDebounced();
    await getChatBackgroundsList();
}

/**
 * Gets a thumbnail for the background from storage or fetches it if not available.
 * It caches the thumbnail in local storage and returns a blob URL for the thumbnail.
 * If the thumbnail cannot be fetched, it returns a transparent PNG pixel as a fallback.
 * @param {string} bg Background URL
 * @returns {Promise<string>} Blob URL of the thumbnail
 */
async function getThumbnailFromStorage(bg) {
    const cachedBlobUrl = THUMBNAIL_BLOBS.get(bg);
    if (cachedBlobUrl) {
        return cachedBlobUrl;
    }

    const savedBlob = await THUMBNAIL_STORAGE.getItem(bg);
    if (savedBlob) {
        const savedBlobUrl = URL.createObjectURL(savedBlob);
        THUMBNAIL_BLOBS.set(bg, savedBlobUrl);
        return savedBlobUrl;
    }

    try {
        const response = await fetch(getBackgroundPath(bg), { cache: 'force-cache' });
        if (!response.ok) {
            throw new Error('Fetch failed with status: ' + response.status);
        }
        const imageBlob = await response.blob();
        const imageBase64 = await getBase64Async(imageBlob);
        const thumbnailBase64 = await createThumbnail(imageBase64, THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height);
        const thumbnailBlob = await fetch(thumbnailBase64).then(res => res.blob());
        await THUMBNAIL_STORAGE.setItem(bg, thumbnailBlob);
        const blobUrl = URL.createObjectURL(thumbnailBlob);
        THUMBNAIL_BLOBS.set(bg, blobUrl);
        return blobUrl;
    } catch (error) {
        console.error('Error fetching thumbnail, fallback image will be used:', error);
        const fallbackBlob = PNG_PIXEL_BLOB;
        const fallbackBlobUrl = URL.createObjectURL(fallbackBlob);
        THUMBNAIL_BLOBS.set(bg, fallbackBlobUrl);
        return fallbackBlobUrl;
    }
}

/**
 * Gets the new background name from the user.
 * @param {Element} referenceElement
 * @returns {Promise<{oldBg: string, newBg: string}>}
 * */
async function getNewBackgroundName(referenceElement) {
    const exampleBlock = $(referenceElement).closest('.bg_example');
    const isCustom = exampleBlock.attr('custom') === 'true';
    const oldBg = exampleBlock.attr('bgfile');

    if (!oldBg) {
        console.debug('no bgfile');
        return;
    }

    const fileExtension = oldBg.split('.').pop();
    const fileNameBase = isCustom ? oldBg.split('/').pop() : oldBg;
    const oldBgExtensionless = fileNameBase.replace(`.${fileExtension}`, '');
    const newBgExtensionless = await Popup.show.input(t`Enter new background name:`, null, oldBgExtensionless);

    if (!newBgExtensionless) {
        console.debug('no new_bg_extensionless');
        return;
    }

    const newBg = `${newBgExtensionless}.${fileExtension}`;

    if (oldBgExtensionless === newBgExtensionless) {
        console.debug('new_bg === old_bg');
        return;
    }

    return { oldBg, newBg };
}

async function onRenameBackgroundClick(e) {
    e.stopPropagation();

    const bgNames = await getNewBackgroundName(this);

    if (!bgNames) {
        return;
    }

    const data = { old_bg: bgNames.oldBg, new_bg: bgNames.newBg };
    const response = await fetch('/api/backgrounds/rename', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(data),
        cache: 'no-cache',
    });

    if (response.ok) {
        await getBackgrounds();
        highlightNewBackground(bgNames.newBg);
    } else {
        toastr.warning('Failed to rename background');
    }
}

async function onDeleteBackgroundClick(e) {
    e.stopPropagation();
    const bgToDelete = $(this).closest('.bg_example');
    const url = bgToDelete.data('url');
    const isCustom = bgToDelete.attr('custom') === 'true';
    const confirm = await Popup.show.confirm(t`Delete the background?`, null);
    const bg = bgToDelete.attr('bgfile');

    if (confirm) {
        // If it's not custom, it's a built-in background. Delete it from the server
        if (!isCustom) {
            delBackground(bg);
        } else {
            const list = chat_metadata[LIST_METADATA_KEY] || [];
            const index = list.indexOf(bg);
            list.splice(index, 1);
        }

        const siblingSelector = '.bg_example:not(#form_bg_download)';
        const nextBg = bgToDelete.next(siblingSelector);
        const prevBg = bgToDelete.prev(siblingSelector);
        const anyBg = $(siblingSelector);

        if (nextBg.length > 0) {
            nextBg.trigger('click');
        } else if (prevBg.length > 0) {
            prevBg.trigger('click');
        } else {
            $(anyBg[Math.floor(Math.random() * anyBg.length)]).trigger('click');
        }

        bgToDelete.remove();

        if (url === chat_metadata[BG_METADATA_KEY]) {
            removeBackgroundMetadata();
            unsetCustomBackground();
            highlightLockedBackground();
        }

        if (isCustom) {
            await getChatBackgroundsList();
            saveMetadataDebounced();
        }
    }
}

const autoBgPrompt = 'Ignore previous instructions and choose a location ONLY from the provided list that is the most suitable for the current scene. Do not output any other text:\n{0}';

async function autoBackgroundCommand() {
    /** @type {HTMLElement[]} */
    const bgTitles = Array.from(document.querySelectorAll('#bg_menu_content .BGSampleTitle'));
    const options = bgTitles.map(x => ({ element: x, text: x.innerText.trim() })).filter(x => x.text.length > 0);
    if (options.length == 0) {
        toastr.warning('No backgrounds to choose from. Please upload some images to the "backgrounds" folder.');
        return '';
    }

    const list = options.map(option => `- ${option.text}`).join('\n');
    const prompt = stringFormat(autoBgPrompt, list);
    const reply = await generateQuietPrompt(prompt, false, false);
    const fuse = new Fuse(options, { keys: ['text'] });
    const bestMatch = fuse.search(reply, { limit: 1 });

    if (bestMatch.length == 0) {
        for (const option of options) {
            if (String(reply).toLowerCase().includes(option.text.toLowerCase())) {
                console.debug('Fallback choosing background:', option);
                option.element.click();
                return '';
            }
        }

        toastr.warning('No match found. Please try again.');
        return '';
    }

    console.debug('Automatically choosing background:', bestMatch);
    bestMatch[0].item.element.click();
    return '';
}

export async function getBackgrounds() {
    const response = await fetch('/api/backgrounds/all', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });
    if (response.ok) {
        const { images, config } = await response.json();
        Object.assign(THUMBNAIL_CONFIG, config);
        $('#bg_menu_content').children('div').remove();
        for (const bg of images) {
            const template = await getBackgroundFromTemplate(bg, false);
            $('#bg_menu_content').append(template);
        }
        activateLazyLoader();
    }
}

function activateLazyLoader() {
    // Disconnect previous observer to prevent memory leaks
    if (lazyLoadObserver) {
        lazyLoadObserver.disconnect();
        lazyLoadObserver = null;
    }

    const lazyLoadElements = document.querySelectorAll('.lazy-load-background');

    const options = {
        root: null,
        rootMargin: '200px',
        threshold: 0.01,
    };

    lazyLoadObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.target instanceof HTMLElement && entry.isIntersecting) {
                const target = entry.target;
                const bg = target.getAttribute('bgfile');
                const isCustom = target.getAttribute('custom') === 'true';
                resolveImageUrl(bg, isCustom)
                    .then(url => { target.style.backgroundImage = url; })
                    .catch(() => { target.style.backgroundImage = PLACEHOLDER_IMAGE; });
                target.classList.remove('lazy-load-background');
                observer.unobserve(target);
            }
        });
    }, options);

    lazyLoadElements.forEach(element => {
        lazyLoadObserver.observe(element);
    });
}

/**
 * Gets the CSS URL of the background
 * @param {Element} block
 * @returns {string} URL of the background
 */
function getUrlParameter(block) {
    return $(block).closest('.bg_example').data('url');
}

function generateUrlParameter(bg, isCustom) {
    return isCustom ? `url("${encodeURI(bg)}")` : `url("${getBackgroundPath(bg)}")`;
}

/**
 * Resolves the image URL for the background.
 * @param {string} bg Background file name
 * @param {boolean} isCustom Is a custom background
 * @returns {Promise<string>} CSS URL of the background
 */
async function resolveImageUrl(bg, isCustom) {
    const fileExtension = bg.split('.').pop().toLowerCase();
    const isAnimated = ['mp4', 'webp'].includes(fileExtension);
    const thumbnailUrl = isAnimated && !background_settings.animation
        ? await getThumbnailFromStorage(bg)
        : isCustom
            ? bg
            : getThumbnailUrl('bg', bg);

    return `url('${thumbnailUrl}')`;
}

/**
 * Instantiates a background template
 * @param {string} bg Path to background
 * @param {boolean} isCustom Whether the background is custom
 * @returns {Promise<JQuery<HTMLElement>>} Background template
 */
async function getBackgroundFromTemplate(bg, isCustom) {
    const template = $('#background_template .bg_example').clone();
    const url = generateUrlParameter(bg, isCustom);
    const title = isCustom ? bg.split('/').pop() : bg;
    const friendlyTitle = title.slice(0, title.lastIndexOf('.'));

    template.attr('title', title);
    template.attr('bgfile', bg);
    template.attr('custom', String(isCustom));
    template.data('url', url);
    template.addClass('lazy-load-background');
    template.css('background-image', PLACEHOLDER_IMAGE);
    template.find('.BGSampleTitle').text(friendlyTitle);
    return template;
}

async function setBackground(bg, url) {
    $('#bg1').css('background-image', url);
    background_settings.name = bg;
    background_settings.url = url;
    saveSettingsDebounced();
}

async function delBackground(bg) {
    await fetch('/api/backgrounds/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            bg: bg,
        }),
    });

    await THUMBNAIL_STORAGE.removeItem(bg);
    if (THUMBNAIL_BLOBS.has(bg)) {
        URL.revokeObjectURL(THUMBNAIL_BLOBS.get(bg));
        THUMBNAIL_BLOBS.delete(bg);
    }
}

async function onBackgroundUploadSelected() {
    const form = $('#form_bg_download').get(0);

    if (!(form instanceof HTMLFormElement)) {
        console.error('form_bg_download is not a form');
        return;
    }

    const formData = new FormData(form);
    await convertFileIfVideo(formData);
    await uploadBackground(formData);
    form.reset();
}

/**
 * Converts a video file to an animated webp format if the file is a video.
 * @param {FormData} formData
 * @returns {Promise<void>}
 */
async function convertFileIfVideo(formData) {
    const file = formData.get('avatar');
    if (!(file instanceof File)) {
        return;
    }
    if (!file.type.startsWith('video/')) {
        return;
    }
    if (typeof globalThis.convertVideoToAnimatedWebp !== 'function') {
        toastr.warning(t`Click here to install the Video Background Loader extension`, t`Video background uploads require a downloadable add-on`, {
            timeOut: 0,
            extendedTimeOut: 0,
            onclick: () => openThirdPartyExtensionMenu('https://github.com/SillyTavern/Extension-VideoBackgroundLoader'),
        });
        return;
    }

    let toastMessage = jQuery();
    try {
        toastMessage = toastr.info(t`Preparing video for upload. This may take several minutes.`, t`Please wait`, { timeOut: 0, extendedTimeOut: 0 });
        const sourceBuffer = await file.arrayBuffer();
        const convertedBuffer = await globalThis.convertVideoToAnimatedWebp({ buffer: new Uint8Array(sourceBuffer), name: file.name });
        const convertedFileName = file.name.replace(/\.[^/.]+$/, '.webp');
        const convertedFile = new File([convertedBuffer], convertedFileName, { type: 'image/webp' });
        formData.set('avatar', convertedFile);
        toastMessage.remove();
    } catch (error) {
        formData.delete('avatar');
        toastMessage.remove();
        console.error('Error converting video to animated webp:', error);
        toastr.error(t`Error converting video to animated webp`);
    }
}

/**
 * Uploads a background to the server
 * @param {FormData} formData
 */
async function uploadBackground(formData) {
    try {
        if (!formData.has('avatar')) {
            console.log('No file provided. Background upload cancelled.');
            return;
        }

        const headers = getRequestHeaders();
        delete headers['Content-Type'];

        const response = await fetch('/api/backgrounds/upload', {
            method: 'POST',
            headers: headers,
            body: formData,
            cache: 'no-cache',
        });

        if (!response.ok) {
            throw new Error('Failed to upload background');
        }

        const bg = await response.text();
        setBackground(bg, generateUrlParameter(bg, false));
        await getBackgrounds();
        highlightNewBackground(bg);
    } catch (error) {
        console.error('Error uploading background:', error);
    }
}

/**
 * @param {string} bg
 */
function highlightNewBackground(bg) {
    const newBg = $(`.bg_example[bgfile="${bg}"]`);
    const scrollOffset = newBg.offset().top - newBg.parent().offset().top;
    $('#Backgrounds').scrollTop(scrollOffset);
    flashHighlight(newBg);
}

/**
 * Sets the fitting class for the background element
 * @param {string} fitting Fitting type
 */
function setFittingClass(fitting) {
    const backgrounds = $('#bg1, #bg_custom');
    for (const option of ['cover', 'contain', 'stretch', 'center']) {
        backgrounds.toggleClass(option, option === fitting);
    }
    background_settings.fitting = fitting;
}

function onBackgroundFilterInput() {
    const filterValue = String($(this).val()).toLowerCase();
    $('#bg_menu_content > div').each(function () {
        const $bgContent = $(this);
        if ($bgContent.attr('title').toLowerCase().includes(filterValue)) {
            $bgContent.show();
        } else {
            $bgContent.hide();
        }
    });
}

export function initBackgrounds() {
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.FORCE_SET_BACKGROUND, forceSetBackground);
    $(document).on('click', '.bg_example', onSelectBackgroundClick);
    $(document).on('click', '.bg_example_lock', onLockBackgroundClick);
    $(document).on('click', '.bg_example_unlock', onUnlockBackgroundClick);
    $(document).on('click', '.bg_example_edit', onRenameBackgroundClick);
    $(document).on('click', '.bg_example_cross', onDeleteBackgroundClick);
    $(document).on('click', '.bg_example_copy', onCopyToSystemBackgroundClick);
    $('#auto_background').on('click', autoBackgroundCommand);
    $('#add_bg_button').on('change', onBackgroundUploadSelected);
    $('#bg-filter').on('input', onBackgroundFilterInput);
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lockbg',
        callback: () => onLockBackgroundClick(new CustomEvent('click')),
        aliases: ['bglock'],
        helpString: 'Locks a background for the currently selected chat',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'unlockbg',
        callback: () => onUnlockBackgroundClick(new CustomEvent('click')),
        aliases: ['bgunlock'],
        helpString: 'Unlocks a background for the currently selected chat',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'autobg',
        callback: autoBackgroundCommand,
        aliases: ['bgauto'],
        helpString: 'Automatically changes the background based on the chat context using the AI request prompt',
    }));

    $('#background_fitting').on('input', function () {
        background_settings.fitting = String($(this).val());
        setFittingClass(background_settings.fitting);
        saveSettingsDebounced();
    });

    $('#background_thumbnails_animation').on('input', async function () {
        background_settings.animation = !!$(this).prop('checked');
        saveSettingsDebounced();

        // Refresh background thumbnails
        await getBackgrounds();
        await onChatChanged();
    });
}
