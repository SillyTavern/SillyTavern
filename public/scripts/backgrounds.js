import { Fuse } from '../lib.js';

import { callPopup, chat_metadata, getThumbnailUrl, eventSource, event_types, generateQuietPrompt, getCurrentChatId, getRequestHeaders, saveSettingsDebounced } from '../script.js';
import { saveMetadataDebounced } from './extensions.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { flashHighlight, stringFormat } from './utils.js';
import { t } from './i18n.js';

const BG_METADATA_KEY = 'custom_background';
const LIST_METADATA_KEY = 'chat_backgrounds';

export let background_settings = {
    type: 'image', // Can be 'image' or 'video'
    name: '__transparent.png',
    url: generateUrlParameter('__transparent.png', false),
	videoName: null,
	videoUrl: null,
    fitting: 'classic',
};

export function loadBackgroundSettings(settings) {
    let backgroundSettings = settings.background;

    if (!backgroundSettings || !(backgroundSettings.name || backgroundSettings.videoName)) {
        backgroundSettings = {
            type: 'image',
            name: '__transparent.png',
            url: generateUrlParameter('__transparent.png', false),
            fitting: 'classic',
			videoName: null,
			videoUrl: null,
        };
    }

    if (!backgroundSettings.type) {
        backgroundSettings.type = 'image';
    }
	
    if (!backgroundSettings.fitting) {
        backgroundSettings.fitting = 'classic';
    }

    Object.assign(background_settings, backgroundSettings);

    if (background_settings.type === 'video' && background_settings.videoName && background_settings.videoUrl) {
        // Ensure applyVideoBackground can handle being called on load
        applyVideoBackground(background_settings.videoName, background_settings.videoUrl);
        console.log('Loaded video background:', background_settings.videoName);
    } else {
        const imgName = background_settings.name || '__transparent.png';
        const imgUrl = background_settings.url || generateUrlParameter(imgName, false);
		background_settings.type = 'image';
        setBackground(imgName, imgUrl);
        console.log('Loaded image background:', imgName);
    }
    
    setFittingClass(background_settings.fitting);
    $('#background_fitting').val(background_settings.fitting);
}

/**
 * Sets the background for the current chat and adds it to the list of custom backgrounds.
 * @param {{url: string, path:string}} backgroundInfo
 */
function forceSetBackground(backgroundInfo) {
    saveBackgroundMetadata(backgroundInfo.url);
    setCustomBackground();

    const list = chat_metadata[LIST_METADATA_KEY] || [];
    const bg = backgroundInfo.path;
    list.push(bg);
    chat_metadata[LIST_METADATA_KEY] = list;
    saveMetadataDebounced();
    getChatBackgroundsList();
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

    getChatBackgroundsList();
    highlightLockedBackground();
}

function getChatBackgroundsList() {
    const list = chat_metadata[LIST_METADATA_KEY];
    const listEmpty = !Array.isArray(list) || list.length === 0;

    $('#bg_custom_content').empty();
    $('#bg_chat_hint').toggle(listEmpty);

    if (listEmpty) {
        return;
    }

    for (const bg of list) {
        const template = getBackgroundFromTemplate(bg, true);
        $('#bg_custom_content').append(template);
    }
}

function getBackgroundPath(fileUrl) {
    return `backgrounds/${fileUrl}`;
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

// --- Functions related to locking/metadata ---

function saveBackgroundMetadata(type, name, url) {
    chat_metadata[BG_METADATA_KEY] = { type, name, url };
    saveMetadataDebounced();
}

function removeBackgroundMetadata() {
    delete chat_metadata[BG_METADATA_KEY];
    saveMetadataDebounced();
}

function hasCustomBackground() {
    return chat_metadata[BG_METADATA_KEY];
}

function setCustomBackground() {
    const lockedBgData = chat_metadata[BG_METADATA_KEY];

    if (!lockedBgData) return;

    unsetCustomBackground();

    if (lockedBgData.type === 'video') {
        // Apply locked video - mimicking applyVideoBackground but for the lock state
        // Note: This assumes the locked video exists and URL is correct.
        // We might need a dedicated container or logic if we want both a
        // "normal" background and a "locked" background overlay simultaneously.
        // For now, assume lock replaces normal background.
        console.log('Applying locked video background:', lockedBgData.name, lockedBgData.url);
        applyVideoBackground(lockedBgData.name, lockedBgData.url);
    }
    else {
        console.log('Applying locked image background:', lockedBgData.url);
        $('#bg_custom').css('background-image', lockedBgData.url);
    }
}
function unsetCustomBackground() {
    $('#bg_custom').css('background-image', 'none'); // Clear locked image
    // If a video was locked, applyVideoBackground would have put it in #bg_video_container.
    // Need to ensure the *currently selected* background (image or video) is reapplied
    // if we unlock. This happens implicitly when a new background is selected,
    // or potentially on chat change if needed. Let's clear the video container
    // just in case, assuming the main background selection logic will handle reapplying.
    $('#bg_video_container').empty();
}

function highlightLockedBackground() {
    $('.bg_example').removeClass('locked');
    const lockedBgData = chat_metadata[BG_METADATA_KEY];

    if (!lockedBgData) {
        return;
    }

    $('.bg_example').each(function () {
        const $this = $(this);
        const itemBgFile = $this.attr('bgfile');
        if (itemBgFile === lockedBgData.name) {
            $this.addClass('locked');
        }
    });
}

function onSelectBackgroundClick() {
    const $this = $(this);
    const isCustom = $this.attr('custom') === 'true';
    const type = $this.data('type');

    if (!type) {
        return;
    }

    let resourceName = $this.attr('bgfile');

    if (type === 'video') {
        let resourceUrl = $this.data('video-url');
        console.log('Selected video:', resourceName, resourceUrl);

        if (hasCustomBackground() || isCustom) {
            saveBackgroundMetadata('video', resourceName, resourceUrl);
            setCustomBackground();
            highlightLockedBackground();
        } else {
             highlightLockedBackground();
        }

        applyVideoBackground(resourceName, resourceUrl);

    } else {
        let resourceUrl = $this.data('url');
        console.log('Selected image:', resourceName, resourceUrl);

        if (hasCustomBackground() || isCustom) {
            saveBackgroundMetadata('image', resourceName, resourceUrl);
            setCustomBackground();
            highlightLockedBackground();
        } else {
            highlightLockedBackground();
        }

        const customBgStyle = window.getComputedStyle(document.getElementById('bg_custom')).backgroundImage;

        // If a custom background (image or video handled by setCustomBackground) is active,
        // only update the underlying #bg1 layer and save settings, don't visually change if #bg_custom overlays it.
        if (customBgStyle !== 'none' && hasCustomBackground()) {
             console.log('Custom background is set, only updating #bg1 potentially.');
             // Ensure the correct image background is set on #bg1 layer even if hidden
             setBackground(resourceName, resourceUrl);
             return;
         }

        // Fetching to browser memory to reduce flicker
        const backgroundUrlToFetch = isCustom ? resourceName : getBackgroundPath(resourceName);
        fetch(backgroundUrlToFetch).then(() => {
            setBackground(resourceName, resourceUrl);
        }).catch((err) => {
            console.error('Background fetch/set failed:', err, backgroundUrlToFetch);
        });
    }
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

    uploadBackground(formData);

    const list = chat_metadata[LIST_METADATA_KEY] || [];
    const index = list.indexOf(bgNames.oldBg);
    list.splice(index, 1);
    saveMetadataDebounced();
    getChatBackgroundsList();
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
    const newBgExtensionless = await callPopup('<h3>' + t`Enter new background name:` + '</h3>', 'input', oldBgExtensionless);

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
    const confirm = await callPopup('<h3>Delete the background?</h3>', 'confirm');
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
            getChatBackgroundsList();
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
/**
 * Fetches the list of background media (images and videos) from the server
 * and updates the UI list.
 */
export async function getBackgrounds() {
    try {
        const response = await fetch('/api/backgrounds/all', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
             console.error(`[/api/backgrounds/all] Fetch failed with status: ${response.status}`);
             return;
        }

        const mediaList = await response.json();

        $('#bg_menu_content').children('.generated-background-item').remove();

        if (!Array.isArray(mediaList)) {
            console.error('[/api/backgrounds/all] Received data is not an array:', mediaList);
            return;
        }

        const $container = $('#bg_menu_content');

        for (const mediaFile of mediaList) {
            try {
                 const template = getBackgroundFromTemplate(mediaFile, false);

                 if (template && template.length > 0) {
                     $container.append(template);
                 } else {
                     console.warn(`[getBackgrounds] Template generation failed or returned empty for: ${mediaFile}`);
                 }
            } catch (templateError) {
                console.error('[getBackgrounds] Error during template creation/append for file:', mediaFile, templateError);
            }
        }
    } catch (error) {
        console.error('Error in getBackgrounds function:', error);
    }
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
 * Instantiates a background template for images and videos.
 * @param {string} mediaFile Path to background (image or video)
 * @param {boolean} isCustom Whether the background is custom (passed from elsewhere, not relevant for system list)
 * @returns {JQuery<HTMLElement>} Background template jQuery object
 */
function getBackgroundFromTemplate(mediaFile, isCustom) {
    const template = $('#background_template .bg_example').clone();
    const title = isCustom ? mediaFile.split('/').pop() : mediaFile;
    const friendlyTitle = title.slice(0, title.lastIndexOf('.')) || title;
    const fileExtension = title.split('.').pop().toLowerCase();
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov'];

    template.addClass('generated-background-item');

    if (videoExtensions.includes(fileExtension)) {
        template.data('type', 'video');
        template.addClass('video-background-item');

        const videoUrl = isCustom ? encodeURI(mediaFile) : `/user-files/backgrounds/${encodeURIComponent(mediaFile)}`;
        template.data('video-url', videoUrl);
		template.addClass('bg-preview-video');
		template.find('.video-icon-overlay').remove();
        template.append('<div class="video-icon-overlay" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:rgba(255,255,255,0.6); pointer-events:none;"><i class="fas fa-video fa-lg"></i></div>');
    
	} else {
        template.data('type', 'image');

        const imageUrlCss = isCustom ? `url("${encodeURI(mediaFile)}")` : `url("${getBackgroundPath(mediaFile)}")`;
        template.data('url', imageUrlCss);
		
        const thumbPath = isCustom ? mediaFile : getThumbnailUrl('bg', mediaFile);

        template.css('background-image', `url('${thumbPath}')`);
    }
    template.attr('title', title);
    template.attr('bgfile', mediaFile);
    template.attr('custom', String(isCustom));
    template.find('.BGSampleTitle').text(friendlyTitle);
    return template;
}

async function setBackground(bg, url) {
    $('#bg_video_container').empty();

    $('#bg1').css('background-image', url);
	
    background_settings.type = 'image';
    background_settings.name = bg;
    background_settings.url = url;

    background_settings.videoName = null;
    background_settings.videoUrl = null;

    saveSettingsDebounced();
}
/**
 * Creates and displays a video background. Handles element creation, attributes, fitting, and playback.
 * @param {string} videoFileName The name of the video file.
 * @param {string} videoUrl The accessible URL for the video file.
 */
async function applyVideoBackground(videoFileName, videoUrl) {
    console.log('Applying video background:', videoFileName, videoUrl);
    const $videoContainer = $('#bg_video_container');

    $videoContainer.empty();
    const videoElement = document.createElement('video');
    videoElement.id = 'bg_video_element';

    videoElement.autoplay = true;
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.src = videoUrl;

    videoElement.onerror = () => {
        console.error(`Error loading video background: ${videoUrl}`);
        toastr.error(`Error loading video background: ${videoFileName}`);
		
        $videoContainer.empty();
    };

    videoElement.oncanplay = () => {
        console.log(`Video background ready to play: ${videoFileName}`);
    };

    $videoContainer.append(videoElement);

    // Call this *after* appending, so the element exists in the DOM for selector matching
    setFittingClass(background_settings.fitting);

    try {
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn(`Video autoplay prevented for ${videoFileName}:`, error);
            });
        }
    } catch (error) {
        console.error(`Error trying to play video ${videoFileName}:`, error);
    }

    $('#bg1').css('background-image', 'none');

    background_settings.type = 'video';
    background_settings.videoName = videoFileName;
    background_settings.videoUrl = videoUrl;
	
    background_settings.name = null;
    background_settings.url = null;
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
}
/**
 * Uploads a background (image or video) to the server using Fetch API.
 * @param {FormData} formData The form data containing the file.
 */
async function uploadBackground(formData) {
    let toastInstance = null;
    try {
        toastInstance = toastr.info('Uploading background...', null, { timeOut: 0, extendedTimeOut: 0 }); // Prevent auto-dismiss

        const response = await fetch('/api/backgrounds/upload', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: formData,
        });

        // Check for network/HTTP errors
        if (!response.ok) {
            let errorMsg = `Upload failed: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = `Upload failed: ${errorData?.error || response.statusText}`;
            } catch (e) {
            }
            throw new Error(errorMsg);
        }

        const result = await response.json();

        if (result && result.success) {
            await getBackgrounds();

            if (result.type === 'image') {
                const imageUrl = generateUrlParameter(result.fileName, false);
                setBackground(result.fileName, imageUrl);
                highlightNewBackground(result.fileName);
                toastr.success('Image background uploaded successfully.');
            } else if (result.type === 'video') {
                applyVideoBackground(result.fileName, result.videoUrl);
                highlightNewBackground(result.fileName);
                toastr.success('Video background uploaded successfully.');
            } else {
                console.error('Upload success, but unknown type received:', result.type);
                toastr.error('Upload succeeded but file type is unrecognized.');
            }
        } else {
            // Handle cases where response.ok is true, but backend indicates failure
            console.error('Upload failed: Invalid server response', result);
            toastr.error(`Failed to upload: ${result?.error || 'Invalid server response'}`);
        }

    } catch (error) {
        console.error('Upload error:', error);
        toastr.error(error.message || 'Failed to upload background.');
    } finally {
        if (toastInstance) {
            toastr.clear(toastInstance);
        }
    }
}

// Ensure onBackgroundUploadSelected still calls form.reset() after calling uploadBackground
function onBackgroundUploadSelected() {
    const form = $('#form_bg_download').get(0);
    if (!(form instanceof HTMLFormElement)) {
        console.error('form_bg_download is not a form');
        return;
    }
    const formData = new FormData(form);
    uploadBackground(formData);
    form.reset();
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
 * Sets the fitting class for the background elements (image, custom overlay, video).
 * @param {string} fitting Fitting type (e.g., 'cover', 'contain')
 */
function setFittingClass(fitting) {
    const imageBackgrounds = $('#bg1, #bg_custom');
    const videoElement = $('#bg_video_element');
    const validFittings = ['classic', 'cover', 'contain', 'stretch', 'center'];
    const currentFitting = validFittings.includes(fitting) ? fitting : 'classic';
    const classToAdd = (currentFitting === 'classic') ? 'cover' : currentFitting;
    const fittingClasses = ['cover', 'contain', 'stretch', 'center'];

    // --- Apply to Images/Overlays ---
    imageBackgrounds.removeClass(fittingClasses.join(' '));
    if (fittingClasses.includes(classToAdd)) {
        imageBackgrounds.addClass(classToAdd);
    }

    // --- Apply to Video ---
    if (videoElement.length) {
        videoElement.removeClass(fittingClasses.join(' '));
        if (fittingClasses.includes(classToAdd)) {
            videoElement.addClass(classToAdd);
        }
    }

    // Update settings state
    background_settings.fitting = currentFitting;
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
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'lockbg',
        callback: () => onLockBackgroundClick(new CustomEvent('click')),
        aliases: ['bglock'],
        helpString: 'Locks a background for the currently selected chat',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'unlockbg',
        callback: () => onUnlockBackgroundClick(new CustomEvent('click')),
        aliases: ['bgunlock'],
        helpString: 'Unlocks a background for the currently selected chat',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'autobg',
        callback: autoBackgroundCommand,
        aliases: ['bgauto'],
        helpString: 'Automatically changes the background based on the chat context using the AI request prompt',
    }));

    $('#background_fitting').on('input', function () {
        const newFitting = String($(this).val());
        setFittingClass(newFitting);
        saveSettingsDebounced();
    });
}
