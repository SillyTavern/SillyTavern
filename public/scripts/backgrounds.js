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
    fitting: 'classic',
};

export function loadBackgroundSettings(settings) {
    let backgroundSettings = settings.background;

    // Default settings if none loaded or invalid
    if (!backgroundSettings || !(backgroundSettings.name || backgroundSettings.videoName)) {
        backgroundSettings = {
            type: 'image',
            name: '__transparent.png',
            url: generateUrlParameter('__transparent.png', false),
            fitting: 'classic',
        };
    }

    // Default fitting if missing
    if (!backgroundSettings.fitting) {
        backgroundSettings.fitting = 'classic';
    }

    // Set global background_settings (important!)
    Object.assign(background_settings, backgroundSettings);


    // --- Apply background based on type ---
    if (background_settings.type === 'video' && background_settings.videoName && background_settings.videoUrl) {
        // Apply video background
        // We need to ensure applyVideoBackground can handle being called on load
        applyVideoBackground(background_settings.videoName, background_settings.videoUrl);
        console.log('Loaded video background:', background_settings.videoName);
    } else {
        // Default to image background (handles invalid type or missing video info)
        // Ensure name and URL are reasonable if type was meant to be image but info missing
        const imgName = background_settings.name || '__transparent.png';
        const imgUrl = background_settings.url || generateUrlParameter(imgName, false); // Recalculate URL if needed
        setBackground(imgName, imgUrl);
        console.log('Loaded image background:', imgName);
    }
    // --- End apply background ---


    // Set fitting class and dropdown value
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
    const $this = $(this); // Get jQuery object for the clicked element
    const isCustom = $this.attr('custom') === 'true';
    const type = $this.data('type'); // Get the type we stored

    // if clicked on upload button / form container (should have no type)
    if (!type) {
        return;
    }

    let relativeBgResource; // Use a generic name

    if (type === 'video') {
        // --- Handle Video Selection ---
        relativeBgResource = $this.data('video-url'); // Use the video URL
        const bgFile = $this.attr('bgfile');
        console.log('Selected video:', bgFile, relativeBgResource);

        // Automatically lock video? Deferring complex locking logic for now.
        // if (hasCustomBackground() || isCustom) { ... }

        // Apply the video background
        applyVideoBackground(bgFile, relativeBgResource); // Use filename and URL

    } else {
        // --- Handle Image Selection (Original Logic) ---
        relativeBgResource = $this.data('url'); // Get the CSS url() parameter
        const bgFile = $this.attr('bgfile');

        // Automatically lock the background if it's custom or other background is locked
        if (hasCustomBackground() || isCustom) {
            saveBackgroundMetadata(relativeBgResource); // Original function likely needs update for videos later
            setCustomBackground(); // Original function likely needs update for videos later
            highlightLockedBackground(); // Original function likely needs update for videos later
        } else {
            // If nothing is locked, ensure any previous lock highlight is removed
            highlightLockedBackground(); // Call it anyway to potentially clear old locks
        }


        const customBg = window.getComputedStyle(document.getElementById('bg_custom')).backgroundImage;

        // Custom background is set. Do not override the layer below
        if (customBg !== 'none') {
            console.log('Custom background is set, not changing #bg1.');
            // Still save the selected background in settings even if #bg_custom overlays it
            // Find the correct URL/name combo for setBackground            // setBackground needs the *filename* and the *css url()* string
            const cssUrlString = relativeBgResource; // data-url already has url(...)
            setBackground(bgFile, cssUrlString); // Save setting even if not visible
            return;
        }


        // Fetching to browser memory to reduce flicker
        // Need the actual file path for fetch, not the CSS url() string
        const backgroundUrlToFetch = isCustom ? bgFile : getBackgroundPath(bgFile);
        fetch(backgroundUrlToFetch).then(() => {
            // setBackground needs the *filename* and the *css url()* string
            const cssUrlString = relativeBgResource; // data-url already has url(...)
            setBackground(bgFile, cssUrlString);
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

// Cleaned-up getBackgrounds function
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
             // Consider adding toastr.error for user feedback
             return;
        }

        const mediaList = await response.json(); // Expect an array of filenames

        // Clear only items previously generated by this function
        $('#bg_menu_content').children('.generated-background-item').remove();

        if (!Array.isArray(mediaList)) {
            console.error('[/api/backgrounds/all] Received data is not an array:', mediaList);
            return;
        }

        const $container = $('#bg_menu_content'); // Cache container element

        // Iterate through the list of media files received from the backend
        for (const mediaFile of mediaList) {
            try {
                 // Generate the UI element for this background file
                 const template = getBackgroundFromTemplate(mediaFile, false);

                 // Append the generated element to the container if it's valid
                 if (template && template.length > 0) {
                     $container.append(template); // Appends to the end of #bg_menu_content
                 } else {
                     console.warn(`[getBackgrounds] Template generation failed or returned empty for: ${mediaFile}`);
                 }
            } catch (templateError) {
                // Log errors during individual item processing but continue with others
                console.error('[getBackgrounds] Error during template creation/append for file:', mediaFile, templateError);
            }
        }
    } catch (error) {
        // Catch errors related to fetch or initial processing
        console.error('Error in getBackgrounds function:', error);
        // Consider adding toastr.error for user feedback
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

// Cleaned-up getBackgroundFromTemplate function
/**
 * Instantiates a background template for images and videos.
 * @param {string} mediaFile Path to background (image or video)
 * @param {boolean} isCustom Whether the background is custom (passed from elsewhere, not relevant for system list)
 * @returns {JQuery<HTMLElement>} Background template jQuery object
 */
function getBackgroundFromTemplate(mediaFile, isCustom) {
    // --- Setup ---
    const template = $('#background_template .bg_example').clone();
    const title = isCustom ? mediaFile.split('/').pop() : mediaFile;
    const friendlyTitle = title.slice(0, title.lastIndexOf('.')) || title; // Use this for display text
    const fileExtension = title.split('.').pop().toLowerCase();
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov']; // Supported video types

    template.addClass('generated-background-item'); // Add class for easy selection/removal

    // --- Logic based on file type ---
    if (videoExtensions.includes(fileExtension)) {
        // --- Video Logic ---
        template.data('type', 'video'); // Mark as video type
        // Generate the URL the video element will use when selected
        const videoUrl = isCustom ? encodeURI(mediaFile) : `/user-files/backgrounds/${encodeURIComponent(mediaFile)}`;
        template.data('video-url', videoUrl); // Store URL for selection logic

        // Style the preview item for video (no background image, placeholder color, icon overlay)
        template.css('background-image', 'none');
        template.css('background-color', '#282c34'); // Dark placeholder color
        template.find('.video-icon-overlay').remove(); // Clear previous icon if any
        // Append a Font Awesome video icon (ensure Font Awesome is loaded)
        template.append('<div class="video-icon-overlay" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:rgba(255,255,255,0.6); pointer-events:none;"><i class="fas fa-video fa-lg"></i></div>');

    } else {
        // --- Image Logic ---
        template.data('type', 'image'); // Mark as image type

        // Calculate the URL for the MAIN background image (used when selected)
        const imageUrlCss = isCustom ? `url("${encodeURI(mediaFile)}")` : `url("${getBackgroundPath(mediaFile)}")`;
        template.data('url', imageUrlCss); // Store main image URL

        // Calculate the path for the THUMBNAIL preview image
        const thumbPath = isCustom ? mediaFile : getThumbnailUrl('bg', mediaFile);

        // Set the CSS background-image for the preview element using the THUMBNAIL path
        // Add basic error handling for image loading if needed (e.g., onerror on an actual img tag)
        template.css('background-image', `url('${thumbPath}')`);
    }

    // --- Common logic for both types ---
    template.attr('title', title); // Full filename in tooltip
    template.attr('bgfile', mediaFile); // Store the original filename/path for backend actions
    template.attr('custom', String(isCustom)); // Mark if custom (though always false here)
    template.find('.BGSampleTitle').text(friendlyTitle); // Set the display text

    return template;
}

async function setBackground(bg, url) {
    // Clear any existing video background
    $('#bg_video_container').empty(); // Remove any <video> element

    // Set the image background
    $('#bg1').css('background-image', url);

    // Update settings object
    background_settings.type = 'image'; // Set type to image
    background_settings.name = bg;
    background_settings.url = url;
    // Remove potential video properties if they exist
    delete background_settings.videoName;
    delete background_settings.videoUrl;

    saveSettingsDebounced();
}
/**
 * Creates and displays a video background. Handles element creation, attributes, fitting, and playback.
 * @param {string} videoFileName The name of the video file.
 * @param {string} videoUrl The accessible URL for the video file.
 */
async function applyVideoBackground(videoFileName, videoUrl) {
    console.log('Applying video background:', videoFileName, videoUrl);

    // Get the container element using jQuery
    const $videoContainer = $('#bg_video_container');

    // --- Video Element Creation Logic ---

    // 1. Empty the container to remove any previous video or content
    $videoContainer.empty();

    // 2. Create a new <video> element
    const videoElement = document.createElement('video');

    // 3. Set the ID for CSS targeting and future reference
    videoElement.id = 'bg_video_element';

    // 4. Set essential attributes for background video playback
    videoElement.autoplay = true; // Try to autoplay
    videoElement.loop = true;     // Loop the video
    videoElement.muted = true;     // Mute audio (essential for autoplay)
    videoElement.playsInline = true; // Important for mobile (iOS)

    // 5. Set the source URL for the video file
    videoElement.src = videoUrl;

    // 6. Add basic error handling for the video element
    videoElement.onerror = () => {
        console.error(`Error loading video background: ${videoUrl}`);
        toastr.error(`Error loading video background: ${videoFileName}`);
        // Optionally clear the container or try to revert to image background
        $videoContainer.empty();
        // Maybe revert to default image?
        // setBackground(defaultImageName, defaultImageUrl);
    };

    // Optional: Event listener for when video can play (useful for debugging or advanced features)
    videoElement.oncanplay = () => {
        console.log(`Video background ready to play: ${videoFileName}`);
        // Ensure fitting is applied *after* metadata is loaded if needed
        setFittingClass(background_settings.fitting);
    };

    // 7. Append the video element to its container
    $videoContainer.append(videoElement);

    // 8. Apply the current fitting class (will apply object-fit via CSS)
    // Call this *after* appending, so the element exists in the DOM for selector matching
    setFittingClass(background_settings.fitting);

    // 9. Attempt to explicitly play the video (helps ensure autoplay works)
    try {
        // play() returns a promise which might be useful, but for now just call it
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Autoplay was prevented. This is common if the page wasn't interacted with first.
                // Since it's muted, it usually works, but good to log if it fails.
                console.warn(`Video autoplay prevented for ${videoFileName}:`, error);
                // We might need a user interaction (like a click) to trigger play if this happens often.
            });
        }
    } catch (error) {
        console.error(`Error trying to play video ${videoFileName}:`, error);
    }
    // --- End Video Element Creation Logic ---

    // --- Settings Update ---
    // Clear any existing image background CSS (redundant check, but safe)
    $('#bg1').css('background-image', 'none');

    // Update the global settings object
    background_settings.type = 'video'; // Set type to video
    background_settings.videoName = videoFileName;
    background_settings.videoUrl = videoUrl;
    // Remove potential image properties
    delete background_settings.name;
    delete background_settings.url;

    // Save settings (debounced)
    saveSettingsDebounced();
    // --- End Settings Update ---


    // Potentially update UI lists/highlighting if needed later
    // await getBackgrounds(); // Only if videos are added to the same list as images
    // highlightNewBackground(videoFileName); // Would need adaptation if videos listed
}

/**
 * Attempts to generate a thumbnail image data URL from a video URL.
 * @param {string} videoUrl The accessible URL of the video.
 * @param {number} seekTime Time in seconds to seek to for the thumbnail.
 * @returns {Promise<string>} A promise that resolves with the image data URL or rejects on error.
 */

// Put on hold permanantly because I'm no good at debugging

async function delBackground(bg) {
    await fetch('/api/backgrounds/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            bg: bg,
        }),
    });
}

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
 * Uploads a background to the server
 * @param {FormData} formData
 */
function uploadBackground(formData) {
    jQuery.ajax({
        type: 'POST',
        url: '/api/backgrounds/upload',
        data: formData,
        beforeSend: function () {
        },
        cache: false,
        contentType: false,
        processData: false,
        success: async function (bg) {
            setBackground(bg, generateUrlParameter(bg, false));
            await getBackgrounds();
            highlightNewBackground(bg);
        },
        error: function (jqXHR, exception) {
            console.log(exception);
            console.log(jqXHR);
        },
    });
}
// ****** NEW Video Upload Functions ******

/**
 * Handles the file selection event for the video background input.
 */
function onVideoBackgroundUploadSelected() {
    const form = $('#form_bg_video_upload').get(0); // Get the VIDEO form

    if (!(form instanceof HTMLFormElement)) {
        console.error('form_bg_video_upload is not a form');
        return;
    }

    // Check if a file was selected
    const fileInput = form.querySelector('#add_bg_video_button');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        console.log('No video file selected.');
        return;
    }

    const formData = new FormData(form);
    // Optional: Add checks for file size or type here if needed on client-side
    // const file = fileInput.files[0];
    // if (file.size > MAX_VIDEO_SIZE) { ... }
    // if (!file.type.startsWith('video/')) { ... }

    uploadVideoBackground(formData); // Call the new VIDEO upload AJAX function
    form.reset();
}

/**
 * Uploads a video background to the server.
 * @param {FormData} formData The form data containing the video file.
 */
function uploadVideoBackground(formData) { // Handles VIDEO uploads
    // Optional: Show some loading indicator specific to video upload
    toastr.info('Uploading video background...'); // Simple notification

    jQuery.ajax({
        type: 'POST',
        url: '/api/backgrounds/upload-video', // NEW Video endpoint
        data: formData,
        beforeSend: function () {
            // Disable upload button?
        },
        cache: false,
        contentType: false,
        processData: false,
        success: async function (response) { // Expect { success: true, fileName: '...', videoUrl: '...' }
            if (response && response.success && response.fileName && response.videoUrl) {
                // Call the function to apply the video background
                applyVideoBackground(response.fileName, response.videoUrl);
                toastr.success('Video background uploaded successfully.');
            } else {
                console.error('Video upload failed: Invalid server response', response);
                toastr.error(`Failed to upload video: ${response?.error || 'Invalid server response'}`);
            }
        },
        error: function (jqXHR, exception) {
            console.error('Video upload error:', exception, jqXHR);
            toastr.error(`Failed to upload video background. ${jqXHR.responseJSON?.error || jqXHR.statusText || ''}`);
        },
        complete: function () {
            // Hide loading indicator, re-enable button?
        },
    });
}
// ****** END NEW Video Upload Functions ******

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
/**
 * Sets the fitting class for the background elements (image, custom overlay, video).
 * @param {string} fitting Fitting type (e.g., 'cover', 'contain')
 */
function setFittingClass(fitting) {
    // Target image layer, custom overlay layer, AND video element (if it exists)
    const imageBackgrounds = $('#bg1, #bg_custom');
    const videoElement = $('#bg_video_element'); // Use jQuery selector

    // Define valid fitting options
    const validFittings = ['classic', 'cover', 'contain', 'stretch', 'center'];
    const currentFitting = validFittings.includes(fitting) ? fitting : 'classic'; // Default to classic if invalid

    // Apply specific background-* CSS for images/overlays
    for (const option of validFittings) {
        // 'classic' doesn't have a dedicated class in the provided CSS, assume it means default 'cover' or reset
        const applyClass = (option === 'classic') ? 'cover' : option; // Map classic to cover for images for now, or adjust as needed
        imageBackgrounds.toggleClass(applyClass, applyClass === currentFitting || (currentFitting === 'classic' && applyClass === 'cover'));
        // Ensure other classes are removed if not the current one
        if (applyClass !== currentFitting && !(currentFitting === 'classic' && applyClass === 'cover')) {
            imageBackgrounds.removeClass(applyClass);
        }
    }

    // Apply corresponding object-fit CSS class for video
    if (videoElement.length) { // Check if video element exists
        videoElement.removeClass('cover contain stretch center'); // Remove old classes first
        // Map 'classic' fitting for video (e.g., default to 'cover')
        const videoFittingClass = (currentFitting === 'classic') ? 'cover' : currentFitting;
        if (['cover', 'contain', 'stretch', 'center'].includes(videoFittingClass)) {
            // Add the correct class - CSS rules (to be added later) will handle object-fit
            videoElement.addClass(videoFittingClass);
        }
    }

    // Update settings state (but don't save here, save happens in the input listener)
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
    // >>> NEW Video upload listener <<<
    $('#add_bg_video_button').on('change', onVideoBackgroundUploadSelected);
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

    // Fitting dropdown listener (now implicitly handles video via setFittingClass)
    $('#background_fitting').on('input', function () {
        const newFitting = String($(this).val()); // Get value
        setFittingClass(newFitting); // Apply class to image/video (also updates background_settings.fitting)
        saveSettingsDebounced(); // Save settings
    });
}
