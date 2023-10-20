import { callPopup, chat_metadata, eventSource, event_types, generateQuietPrompt, getCurrentChatId, getRequestHeaders, getThumbnailUrl } from "../script.js";
import { saveMetadataDebounced } from "./extensions.js";
import { registerSlashCommand } from "./slash-commands.js";
import { stringFormat } from "./utils.js";

const METADATA_KEY = 'custom_background';

/**
 * @param {string} background
 */
function forceSetBackground(background) {
    saveBackgroundMetadata(background);
    setCustomBackground();
    highlightLockedBackground();
}

async function onChatChanged() {
    if (hasCustomBackground()) {
        setCustomBackground();
    }
    else {
        unsetCustomBackground();
    }

    highlightLockedBackground();
}

function getBackgroundPath(fileUrl) {
    return `backgrounds/${fileUrl}`;
}

function highlightLockedBackground() {
    $('.bg_example').removeClass('locked');

    const lockedBackground = chat_metadata[METADATA_KEY];

    if (!lockedBackground) {
        return;
    }

    $(`.bg_example`).each(function () {
        const url = $(this).data('url');
        if (url === lockedBackground) {
            $(this).addClass('locked');
        }
    });
}

function onLockBackgroundClick(e) {
    e.stopPropagation();

    const chatName = getCurrentChatId();

    if (!chatName) {
        toastr.warning('Select a chat to lock the background for it');
        return;
    }

    const relativeBgImage = getUrlParameter(this);

    saveBackgroundMetadata(relativeBgImage);
    setCustomBackground();
    highlightLockedBackground();
}

function onUnlockBackgroundClick(e) {
    e.stopPropagation();
    removeBackgroundMetadata();
    unsetCustomBackground();
    highlightLockedBackground();
}

function hasCustomBackground() {
    return chat_metadata[METADATA_KEY];
}

function saveBackgroundMetadata(file) {
    chat_metadata[METADATA_KEY] = file;
    saveMetadataDebounced();
}

function removeBackgroundMetadata() {
    delete chat_metadata[METADATA_KEY];
    saveMetadataDebounced();
}

function setCustomBackground() {
    const file = chat_metadata[METADATA_KEY];

    // bg already set
    if (document.getElementById("bg_custom").style.backgroundImage == file) {
        return;
    }

    $("#bg_custom").css("background-image", file);
}

function unsetCustomBackground() {
    $("#bg_custom").css("background-image", 'none');
}

function onSelectBackgroundClick() {
    const relativeBgImage = getUrlParameter(this);

    // if clicked on upload button
    if (!relativeBgImage) {
        return;
    }

    if (hasCustomBackground()) {
        saveBackgroundMetadata(relativeBgImage);
        setCustomBackground();
    }

    highlightLockedBackground();
    const customBg = window.getComputedStyle(document.getElementById('bg_custom')).backgroundImage;

    // custom background is set. Do not override the layer below
    if (customBg !== 'none') {
        return;
    }

    const bgFile = $(this).attr("bgfile");
    const backgroundUrl = getBackgroundPath(bgFile);

    // fetching to browser memory to reduce flicker
    fetch(backgroundUrl).then(() => {
        $("#bg1").css("background-image", relativeBgImage);
        setBackground(bgFile);
    }).catch(() => {
        console.log('Background could not be set: ' + backgroundUrl);
    });
}

async function onRenameBackgroundClick(e) {
    e.stopPropagation();
    const old_bg = $(this).closest('.bg_example').attr('bgfile');

    if (!old_bg) {
        console.debug('no bgfile');
        return;
    }

    const fileExtension = old_bg.split('.').pop();
    const old_bg_extensionless = old_bg.replace(`.${fileExtension}`, '');
    const new_bg_extensionless = await callPopup('<h3>Enter new background name:</h3>', 'input', old_bg_extensionless);

    if (!new_bg_extensionless) {
        console.debug('no new_bg_extensionless');
        return;
    }

    const new_bg = `${new_bg_extensionless}.${fileExtension}`;

    if (old_bg_extensionless === new_bg_extensionless) {
        console.debug('new_bg === old_bg');
        return;
    }

    const data = { old_bg, new_bg };
    const response = await fetch('/renamebackground', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(data),
        cache: 'no-cache',
    });

    if (response.ok) {
        await getBackgrounds();
        highlightNewBackground(new_bg);
    } else {
        toastr.warning('Failed to rename background');
    }
}

async function onDeleteBackgroundClick(e) {
    e.stopPropagation();
    const bgToDelete = $(this).closest('.bg_example');
    const url = bgToDelete.data('url');
    const confirm = await callPopup("<h3>Delete the background?</h3>", 'confirm');

    if (confirm) {
        delBackground(bgToDelete.attr("bgfile"));

        const siblingSelector = '.bg_example:not(#form_bg_download)';
        const nextBg = bgToDelete.next(siblingSelector);
        const prevBg = bgToDelete.prev(siblingSelector);

        if (nextBg.length > 0) {
            nextBg.trigger('click');
        } else {
            prevBg.trigger('click');
        }

        bgToDelete.remove();

        if (url === chat_metadata[METADATA_KEY]) {
            removeBackgroundMetadata();
            unsetCustomBackground();
            highlightLockedBackground();
        }
    }
}

const autoBgPrompt = `Pause your roleplay and choose a location ONLY from the provided list that is the most suitable for the current scene. Do not output any other text:\n{0}`;

async function autoBackgroundCommand() {
    const options = Array.from(document.querySelectorAll('.BGSampleTitle')).map(x => ({ element: x, text: x.innerText.trim() })).filter(x => x.text.length > 0);
    if (options.length == 0) {
        toastr.warning('No backgrounds to choose from. Please upload some images to the "backgrounds" folder.');
        return;
    }

    const list = options.map(option => `- ${option.text}`).join('\n');
    const prompt = stringFormat(autoBgPrompt, list);
    const reply = await generateQuietPrompt(prompt, false, false);
    const fuse = new Fuse(options, { keys: ['text'] });
    const bestMatch = fuse.search(reply, { limit: 1 });

    if (bestMatch.length == 0) {
        toastr.warning('No match found. Please try again.');
        return;
    }

    console.debug('Automatically choosing background:', bestMatch);
    bestMatch[0].item.element.click();
}

export async function getBackgrounds() {
    const response = await fetch("/getbackgrounds", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({
            "": "",
        }),
    });
    if (response.ok === true) {
        const getData = await response.json();
        //background = getData;
        //console.log(getData.length);
        $("#bg_menu_content").children('div').remove();
        for (const bg of getData) {
            const template = getBackgroundFromTemplate(bg, false);
            $("#bg_menu_content").append(template);
        }
    }
}

/**
 * Gets the URL of the background
 * @param {Element} block
 * @returns {string} URL of the background
 */
function getUrlParameter(block) {
    return $(block).closest(".bg_example").data("url");
}

/**
 * Instantiates a background template
 * @param {string} bg Path to background
 * @param {boolean} isCustom Whether the background is custom
 * @returns
 */
function getBackgroundFromTemplate(bg, isCustom) {
    const thumbPath = getThumbnailUrl('bg', bg);
    const template = $('#background_template .bg_example').clone();
    const url = isCustom ? `url("${bg}")` : `url("${getBackgroundPath(bg)}")`;
    template.attr('title', bg);
    template.attr('bgfile', bg);
    template.attr('custom', String(isCustom));
    template.data('url', url);
    template.css('background-image', `url('${thumbPath}')`);
    template.find('.BGSampleTitle').text(bg.slice(0, bg.lastIndexOf('.')));
    return template;
}

async function setBackground(bg) {
    jQuery.ajax({
        type: "POST", //
        url: "/setbackground", //
        data: JSON.stringify({
            bg: bg,
        }),
        beforeSend: function () {

        },
        cache: false,
        dataType: "json",
        contentType: "application/json",
        //processData: false,
        success: function (html) { },
        error: function (jqXHR, exception) {
            console.log(exception);
            console.log(jqXHR);
        },
    });
}

async function delBackground(bg) {
    const response = await fetch("/delbackground", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({
            bg: bg,
        }),
    });
}

function onBackgroundUploadSelected() {
    const input = this;

    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function (e) {
            const form = $("#form_bg_download").get(0);

            if (!(form instanceof HTMLFormElement)) {
                console.error('form_bg_download is not a form');
                return;
            }

            const formData = new FormData(form);

            //console.log(formData);
            jQuery.ajax({
                type: "POST",
                url: "/downloadbackground",
                data: formData,
                beforeSend: function () {

                },
                cache: false,
                contentType: false,
                processData: false,
                success: async function (bg) {
                    form.reset();
                    setBackground(bg);
                    $("#bg1").css("background-image", `url("${getBackgroundPath(bg)}"`);
                    await getBackgrounds();
                    highlightNewBackground(bg);
                },
                error: function (jqXHR, exception) {
                    form.reset();
                    console.log(exception);
                    console.log(jqXHR);
                },
            });
        };

        reader.readAsDataURL(input.files[0]);
    }
}

/**
 * @param {string} bg
 */
function highlightNewBackground(bg) {
    const newBg = $(`.bg_example[bgfile="${bg}"]`);
    const scrollOffset = newBg.offset().top - newBg.parent().offset().top;
    $('#Backgrounds').scrollTop(scrollOffset);
    newBg.addClass('flash animated');
    setTimeout(() => newBg.removeClass('flash animated'), 2000);
}

function onBackgroundFilterInput() {
    const filterValue = String($(this).val()).toLowerCase();
    $("#bg_menu_content > div").each(function () {
        const $bgContent = $(this);
        if ($bgContent.attr("title").toLowerCase().includes(filterValue)) {
            $bgContent.show();
        } else {
            $bgContent.hide();
        }
    });
}

export function initBackgrounds() {
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.FORCE_SET_BACKGROUND, forceSetBackground);
    $(document).on("click", ".bg_example", onSelectBackgroundClick);
    $(document).on('click', '.bg_example_lock', onLockBackgroundClick);
    $(document).on('click', '.bg_example_unlock', onUnlockBackgroundClick);
    $(document).on('click', '.bg_example_edit', onRenameBackgroundClick);
    $(document).on("click", ".bg_example_cross", onDeleteBackgroundClick);
    $('#auto_background').on("click", autoBackgroundCommand);
    $("#add_bg_button").on('change', onBackgroundUploadSelected);
    $("#bg-filter").on("input", onBackgroundFilterInput);
    registerSlashCommand('lockbg', onLockBackgroundClick, ['bglock'], "– locks a background for the currently selected chat", true, true);
    registerSlashCommand('unlockbg', onUnlockBackgroundClick, ['bgunlock'], '– unlocks a background for the currently selected chat', true, true);
    registerSlashCommand('autobg', autoBackgroundCommand, ['bgauto'], '– automatically changes the background based on the chat context using the AI request prompt', true, true);
}
