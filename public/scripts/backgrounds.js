import { Fuse } from '../lib.js';

import { callPopup, chat_metadata, eventSource, event_types, generateQuietPrompt, getCurrentChatId, getRequestHeaders, getThumbnailUrl, saveSettingsDebounced } from '../script.js';
import { saveMetadataDebounced } from './extensions.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { flashHighlight, stringFormat } from './utils.js';
import { t } from './i18n.js';

const BG_METADATA_KEY = 'custom_background';
const LIST_METADATA_KEY = 'chat_backgrounds';

export let background_settings = {
    type: 'image',
    name: '__transparent.png',
    url: generateUrlParameter('__transparent.png', false),
    videoName: null,
    videoUrl: null,
    fitting: 'classic',
};

export function loadBackgroundSettings(settings) {
    let loadedSettings = settings.background;

    let currentBgSettings = { ...background_settings }; // Copy defaults

    if (loadedSettings) {
        // Merge saved settings over defaults
        Object.assign(currentBgSettings, loadedSettings);
    }

    // Ensure essential fields have fallbacks if missing after merge
    if (!currentBgSettings.type) {
        currentBgSettings.type = 'image'; // Default to image if type is missing
    }
    if (!currentBgSettings.fitting) {
        currentBgSettings.fitting = 'classic';
    }
    if (currentBgSettings.type === 'image' && (!currentBgSettings.name || !currentBgSettings.url)) {
        currentBgSettings.name = '__transparent.png';
        currentBgSettings.url = generateUrlParameter('__transparent.png', false);
    }
    if (currentBgSettings.type === 'video' && (!currentBgSettings.videoName || !currentBgSettings.videoUrl)) {
        // If video type is saved but details are missing, revert to default image
        console.warn('Video background settings incomplete, reverting to default image.');
        currentBgSettings.type = 'image';
        currentBgSettings.name = '__transparent.png';
        currentBgSettings.url = generateUrlParameter('__transparent.png', false);
        currentBgSettings.videoName = null;
        currentBgSettings.videoUrl = null;
    }

    Object.assign(background_settings, currentBgSettings);

    // Apply the determined background type
    if (background_settings.type === 'video') {
        applyVideoBackground(background_settings.videoName, background_settings.videoUrl);
        console.log('Loaded video background:', background_settings.videoName);
    } else {
        setBackground(background_settings.name, background_settings.url);
        console.log('Loaded image background:', background_settings.name);
    }

    // Apply fitting and update dropdown
    setFittingClass(background_settings.fitting);
    $('#background_fitting').val(background_settings.fitting);
}

// Sets an image background
async function setBackground(bg, url) {
    // Clear any existing video
    $('#bg_video_container').empty();

    // Set the image on the primary background layer
    $('#bg1').css('background-image', url);

    // Update global state for image type
    background_settings.type = 'image';
    background_settings.name = bg;
    background_settings.url = url;
    background_settings.videoName = null; // Ensure video properties are null
    background_settings.videoUrl = null;

    // Save the updated settings
    saveSettingsDebounced();
}

/**
 * Creates and displays a video background.
 * @param {string} videoFileName The name of the video file.
 * @param {string} videoUrl The accessible URL for the video file.
 */
async function applyVideoBackground(videoFileName, videoUrl) {
    const $videoContainer = $('#bg_video_container');
    $videoContainer.empty(); // Clear previous video/content

    const videoElement = document.createElement('video');
    videoElement.id = 'bg_video_element'; // Assign ID for styling/selection
    videoElement.autoplay = true;
    videoElement.loop = true;
    videoElement.muted = true; // Muted is essential for reliable autoplay
    videoElement.playsInline = true; // Important for mobile browsers
    videoElement.src = videoUrl;

    videoElement.onerror = () => {
        console.error(`Error loading video background: ${videoUrl}`);
        toastr.error(`Failed to load video: ${videoFileName}`);
        $videoContainer.empty(); // Remove broken element
        // Optionally revert to a default background here
    };

    $videoContainer.append(videoElement);

    // Apply fitting class *after* element is in DOM
    setFittingClass(background_settings.fitting);

    // Attempt to play, catching potential errors (e.g., browser restrictions)
    try {
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Autoplay might be blocked by the browser
                console.warn(`Video autoplay prevented for ${videoFileName}:`, error);
                // Maybe show an unmute button or notification here
            });
        }
    } catch (error) {
        console.error(`Error attempting to play video ${videoFileName}:`, error);
    }

    // Clear the image background layer
    $('#bg1').css('background-image', 'none');

    // Update global state for video type
    background_settings.type = 'video';
    background_settings.videoName = videoFileName;
    background_settings.videoUrl = videoUrl;
    background_settings.name = null; // Ensure image properties are null
    background_settings.url = null;

    // Save the updated settings
    saveSettingsDebounced();
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

function highlightLockedBackground() {
    $('.bg_example.generated-background-item').removeClass('locked'); // Target only generated items
    const lockedBgData = chat_metadata[BG_METADATA_KEY];

    if (!lockedBgData || !lockedBgData.name) {
        return; // No lock data or name missing
    }

    // Find the item by the stored name using the bgfile attribute
    $(`.bg_example.generated-background-item[bgfile="${CSS.escape(lockedBgData.name)}"]`).addClass('locked');
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

// Check if custom background metadata exists
function hasCustomBackground() {
    return !!chat_metadata[BG_METADATA_KEY];
}

function saveBackgroundMetadata(type, name, url) {
    chat_metadata[BG_METADATA_KEY] = { type, name, url };
    saveMetadataDebounced();
}

function removeBackgroundMetadata() {
    delete chat_metadata[BG_METADATA_KEY];
    saveMetadataDebounced();
}

// Apply the locked background (image or video)
function setCustomBackground() {
    const lockedBgData = chat_metadata[BG_METADATA_KEY];

    unsetCustomBackground(); // Clear previous custom state first

    if (!lockedBgData) return;

    if (lockedBgData.type === 'video' && lockedBgData.url) {
        console.log('Applying locked video background:', lockedBgData.name);
        // Apply locked video - essentially duplicates applyVideoBackground but without saving global state
        const $videoContainer = $('#bg_video_container');
        $videoContainer.empty();
        const videoElement = document.createElement('video');
        videoElement.id = 'bg_video_element'; // Consistent ID needed for fitting
        videoElement.autoplay = true; videoElement.loop = true; videoElement.muted = true; videoElement.playsInline = true;
        videoElement.src = lockedBgData.url;
        videoElement.onerror = () => { console.error('Error loading locked video'); $videoContainer.empty(); };
        $videoContainer.append(videoElement);
        // Apply fitting based on current global setting
        setFittingClass(background_settings.fitting);
        try {
            videoElement.play().catch(() => {
                // Autoplay errors are expected and ignored for locked backgrounds
            });
        } catch (e) {
            // Synchronous play errors are rare and also ignored here
        }
        $('#bg_custom').css('background-image', 'none'); // Ensure custom image layer is clear
    }
    else if (lockedBgData.type === 'image' && lockedBgData.url) {
        console.log('Applying locked image background:', lockedBgData.name);
        $('#bg_custom').css('background-image', lockedBgData.url); // Apply image to overlay
    }
}

// Clear the custom background state
function unsetCustomBackground() {
    $('#bg_custom').css('background-image', 'none');
    $('#bg_video_container').empty();
}

// Handles clicks on background items in the list
function onSelectBackgroundClick() {
    const $this = $(this);
    const isCustom = $this.attr('custom') === 'true';
    const type = $this.data('type');
    const resourceName = $this.attr('bgfile'); // The filename

    if (!type || !resourceName) {
        console.warn('Background item clicked without type or bgfile attribute.');
        return; // Ignore clicks on non-data items like the upload button
    }

    let resourceUrl; // This will be the image `url(...)` string or the video path

    // Determine action based on type
    if (type === 'video') {
        resourceUrl = $this.data('video-url');
        if (!resourceUrl) {
            console.error('Video item clicked but data-video-url is missing.');
            return;
        }
        console.log('Selected video:', resourceName, resourceUrl);
        applyVideoBackground(resourceName, resourceUrl);
    } else { // Assume image
        resourceUrl = $this.data('url');
        if (!resourceUrl) {
            console.error('Image item clicked but data-url is missing.');
            return;
        }
        console.log('Selected image:', resourceName, resourceUrl);
        const backgroundUrlToFetch = getBackgroundPath(resourceName);
        fetch(backgroundUrlToFetch).then(() => {
            setBackground(resourceName, resourceUrl);
        }).catch((err) => { console.error('Background fetch/set failed:', err); });
    }

    if (hasCustomBackground() || isCustom) {
        saveBackgroundMetadata(type, resourceName, resourceUrl);
        highlightLockedBackground();
    } else {
        // If no lock is active and item isn't custom, ensure highlighting is correct
        highlightLockedBackground();
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

export async function getBackgrounds() {
    try {
        const response = await fetch('/api/backgrounds/all', {
            method: 'POST', // Keep POST if required by server setup, though GET is more appropriate
            headers: getRequestHeaders(),
            // body: JSON.stringify({ '': '' }), // Body is likely unnecessary
        });

        if (!response.ok) {
            console.error(`Error fetching background list: ${response.status} ${response.statusText}`);
            toastr.error('Failed to load background list.');
            return;
        }

        const mediaList = await response.json();

        if (!Array.isArray(mediaList)) {
            console.error('Received invalid data for background list:', mediaList);
            toastr.error('Failed to process background list.');
            return;
        }

        const $container = $('#bg_menu_content');
        // Clear only generated items, keep the upload form
        $container.children('.generated-background-item').remove();

        for (const mediaFile of mediaList) {
            try {
                // Generate template for image or video
                const template = getBackgroundFromTemplate(mediaFile, false);
                if (template && template.length > 0) {
                    $container.append(template);
                }
            } catch (templateError) {
                console.error(`Error creating template for ${mediaFile}:`, templateError);
            }
        }
        // Re-apply highlighting for locked background after list refresh
        highlightLockedBackground();

    } catch (error) {
        console.error('Error in getBackgrounds:', error);
        toastr.error('An error occurred while fetching backgrounds.');
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
 * @param {string} mediaFile Path to background (image or video filename)
 * @param {boolean} isCustom Whether the background is custom (not typically used here)
 * @returns {JQuery<HTMLElement>} Background template jQuery object
 */
function getBackgroundFromTemplate(mediaFile, isCustom) {
    // Clone the base template defined in HTML
    const template = $('#background_template .bg_example').clone();
    template.removeClass('template_element'); // Ensure template class is removed
    template.addClass('generated-background-item'); // Add class for easy clearing

    // Extract filename details
    const title = mediaFile;
    const friendlyTitle = title.slice(0, title.lastIndexOf('.')) || title;
    const fileExtension = title.split('.').pop().toLowerCase();
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'wmv']; // Add more as needed

    // Set common attributes
    template.attr('title', title);
    template.attr('bgfile', mediaFile); // Store the raw filename
    template.attr('custom', String(isCustom)); // Although usually false here
    template.find('.BGSampleTitle').text(friendlyTitle);

    // Configure based on type
    if (videoExtensions.includes(fileExtension)) {
        template.data('type', 'video');
        template.addClass('video-preview'); // Class for CSS styling

        // Construct the URL using the confirmed /backgrounds/ path
        const videoUrl = `/backgrounds/${encodeURIComponent(mediaFile)}`;
        template.data('video-url', videoUrl); // Store URL for click handler

        // Add a visual indicator (Font Awesome icon)
		template.append('<div class="video-icon-overlay"><i class="fa-solid fa-video"></i></div>');

    } else { // Assume image otherwise
        template.data('type', 'image');

        // Construct image URL and thumbnail URL
        const imageUrlCss = `url("${getBackgroundPath(mediaFile)}")`; // Use helper for path if needed
        const thumbPath = getThumbnailUrl('bg', mediaFile); // Use thumbnail service

        template.data('url', imageUrlCss); // Store URL for click handler
        template.css('background-image', `url('${thumbPath}')`); // Set preview thumbnail
    }

    return template;
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

// Handles the file input change event for the unified upload button
function onBackgroundUploadSelected() {
    const form = document.getElementById('form_bg_download'); // Use vanilla JS for simplicity
    if (!(form instanceof HTMLFormElement)) {
        console.error('#form_bg_download not found or not a form');
        return;
    }

    const fileInput = form.querySelector('#add_bg_button');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        // No file selected
        return;
    }

    const formData = new FormData(form);
    uploadBackground(formData); // Call the fetch-based upload function
    form.reset(); // Reset form after initiating upload
}

/**
 * Uploads a background (image or video) using the unified endpoint.
 * @param {FormData} formData The form data containing the file.
 */
async function uploadBackground(formData) {
    let toastInstance = null;
    try {
        // Show indeterminate progress toast
        toastInstance = toastr.info('Uploading background...', null, { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });

        // Get necessary headers (like CSRF) but specifically remove Content-Type
        const headersToSend = getRequestHeaders();
        // Remove the Content-Type header so the browser can set the correct
        // multipart/form-data header with the boundary automatically.
        delete headersToSend['Content-Type'];
        delete headersToSend['content-type'];

        const response = await fetch('/api/backgrounds/upload', {
            method: 'POST',
            headers: headersToSend, // Use the modified headers object
            body: formData,
        });

        // Clear progress toast once response is received
        if (toastInstance) toastr.clear(toastInstance);

        if (!response.ok) {
            let errorMsg = `Upload failed: ${response.statusText}`;
            try {
                // Try to parse a JSON error message from the backend
                const errorData = await response.json();
                errorMsg = `Upload failed: ${errorData?.error || response.statusText}`;
            } catch (e) { /* Ignore if response is not JSON */ }
            throw new Error(errorMsg);
        }

        const result = await response.json();

        if (result && result.success) {
            toastr.success(`Background "${result.fileName}" uploaded successfully.`);
            // Apply the newly uploaded background
            if (result.type === 'image') {
                // Generate the CSS url format needed by setBackground
                const imageUrl = generateUrlParameter(result.fileName, false);
                await setBackground(result.fileName, imageUrl);
            } else if (result.type === 'video' && result.videoUrl) {
                await applyVideoBackground(result.fileName, result.videoUrl);
            } else {
                console.warn('Upload succeeded but type is unknown or videoUrl missing:', result);
                toastr.warning('Upload succeeded but file type is unrecognized.');
            }
            // Refresh the background list and highlight the new item
            await getBackgrounds();
            highlightNewBackground(result.fileName);
        } else {
            // Handle cases where response is ok, but backend JSON indicates failure
            throw new Error(result?.error || 'Upload failed: Invalid server response.');
        }

    } catch (error) {
        if (toastInstance) toastr.clear(toastInstance); // Ensure toast is cleared on error too
        console.error('Background upload error:', error);
        toastr.error(error.message || 'Failed to upload background.');
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
 * Sets the fitting class for background elements (image, custom overlay, video).
 * @param {string} fitting Fitting type (e.g., 'cover', 'contain', 'classic')
 */
function setFittingClass(fitting) {
    const imageBackgrounds = $('#bg1, #bg_custom');
    const videoElement = $('#bg_video_element'); // Select the video element if it exists
    const validFittings = ['classic', 'cover', 'contain', 'stretch', 'center'];
    const fittingClasses = ['cover', 'contain', 'stretch', 'center']; // CSS classes used

    // Determine the actual class to apply ('classic' maps to 'cover')
    const currentFitting = validFittings.includes(fitting) ? fitting : 'classic';
    const classToAdd = (currentFitting === 'classic') ? 'cover' : currentFitting;

    // Apply to image layers
    imageBackgrounds.removeClass(fittingClasses.join(' '));
    if (fittingClasses.includes(classToAdd)) {
        imageBackgrounds.addClass(classToAdd);
    }

    // Apply to video layer if it exists
    if (videoElement.length) {
        videoElement.removeClass(fittingClasses.join(' '));
        if (fittingClasses.includes(classToAdd)) {
            videoElement.addClass(classToAdd);
        }
    }

    // Update the global settings state
    background_settings.fitting = currentFitting;
    // Note: Saving happens in setBackground/applyVideoBackground or when dropdown changes directly
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
    $(document).on('click', '.bg_example.generated-background-item', onSelectBackgroundClick);
    $(document).on('click', '.bg_example_lock', onLockBackgroundClick);
    $(document).on('click', '.bg_example_unlock', onUnlockBackgroundClick);
    $(document).on('click', '.bg_example_edit', onRenameBackgroundClick);
    $(document).on('click', '.bg_example_cross', onDeleteBackgroundClick);
    $(document).on('click', '.bg_example_copy', onCopyToSystemBackgroundClick);
    $('#auto_background').on('click', autoBackgroundCommand);
    $('#bg-filter').on('input', onBackgroundFilterInput);
    $('#add_bg_button').on('change', onBackgroundUploadSelected);
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
