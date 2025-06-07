import {
    eventSource,
    this_chid,
    characters,
    getRequestHeaders,
    event_types,
    animation_duration,
    animation_easing,
} from '../../../script.js';
import { groups, selected_group } from '../../group-chats.js';
import { loadFileToDocument, delay, getBase64Async, getSanitizedFilename } from '../../utils.js';
import { loadMovingUIState } from '../../power-user.js';
import { dragElement } from '../../RossAscends-mods.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { DragAndDropHandler } from '../../dragdrop.js';
import { commonEnumProviders } from '../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { t, translate } from '../../i18n.js';
import { Popup } from '../../popup.js';

const extensionName = 'gallery';
const extensionFolderPath = `scripts/extensions/${extensionName}/`;
let firstTime = true;
let deleteModeActive = false;

// Exposed defaults for future tweaking
let thumbnailHeight = 150;
let paginationVisiblePages = 10;
let paginationMaxLinesPerPage = 2;
let galleryMaxRows = 3;

// Remove all draggables associated with the gallery
$('#movingDivs').on('click', '.dragClose', function () {
    const relatedId = $(this).data('related-id');
    if (!relatedId) return;
    const relatedElement = $(`#movingDivs > .draggable[id="${relatedId}"]`);
    relatedElement.transition({
        opacity: 0,
        duration: animation_duration,
        easing: animation_easing,
        complete: () => {
            relatedElement.remove();
        },
    });
});

const CUSTOM_GALLERY_REMOVED_EVENT = 'galleryRemoved';

const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
            if (node instanceof HTMLElement && node.tagName === 'DIV' && node.id === 'gallery') {
                eventSource.emit(CUSTOM_GALLERY_REMOVED_EVENT);
            }
        });
    });
});

mutationObserver.observe(document.body, {
    childList: true,
    subtree: false,
});

const SORT = Object.freeze({
    NAME_ASC: { value: 'nameAsc', field: 'name', order: 'asc', label: t`Sort By: Name (A-Z)` },
    NAME_DESC: { value: 'nameDesc', field: 'name', order: 'desc', label: t`Sort By: Name (Z-A)` },
    DATE_ASC: { value: 'dateAsc', field: 'date', order: 'asc', label: t`Sort By: Date (Oldest First)` },
    DATE_DESC: { value: 'dateDesc', field: 'date', order: 'desc', label: t`Sort By: Date (Newest First)` },
});

const defaultSettings = Object.freeze({
    folders: {},
    sort: SORT.DATE_ASC.value,
});

/**
 * Initializes the settings for the gallery extension.
 */
function initSettings() {
    let shouldSave = false;
    const context = SillyTavern.getContext();
    if (!context.extensionSettings.gallery) {
        context.extensionSettings.gallery = structuredClone(defaultSettings);
        shouldSave = true;
    }
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(context.extensionSettings.gallery, key)) {
            context.extensionSettings.gallery[key] = structuredClone(defaultSettings[key]);
            shouldSave = true;
        }
    }
    if (shouldSave) {
        context.saveSettingsDebounced();
    }
}

/**
 * Retrieves the gallery folder for a given character.
 * @param {import('../../char-data.js').v1CharData} char Character data
 * @returns {string} The gallery folder for the character
 */
function getGalleryFolder(char) {
    return SillyTavern.getContext().extensionSettings.gallery.folders[char?.avatar] ?? char?.name;
}

/**
 * Retrieves a list of gallery items based on a given URL. This function calls an API endpoint
 * to get the filenames and then constructs the item list.
 *
 * @param {string} url - The base URL to retrieve the list of images.
 * @returns {Promise<Array>} - Resolves with an array of gallery item objects, rejects on error.
 */
async function getGalleryItems(url) {
    const sortValue = getSortOrder();
    const sortObj = Object.values(SORT).find(it => it.value === sortValue) ?? SORT.DATE_ASC;
    const response = await fetch('/api/images/list', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            folder: url,
            sortField: sortObj.field,
            sortOrder: sortObj.order,
        }),
    });

    url = await getSanitizedFilename(url);

    const data = await response.json();
    const items = data.map((file) => ({
        src: `user/images/${url}/${file}`,
        srct: `user/images/${url}/${file}`,
        title: '', // Optional title for each item
    }));

    return items;
}

/**
 * Retrieves a list of gallery folders. This function calls an API endpoint
 * @returns {Promise<string[]>} - Resolves with an array of gallery folders.
 */
async function getGalleryFolders() {
    try {
        const response = await fetch('/api/images/folders', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error(`HTTP error. Status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch gallery folders:', error);
        return [];
    }
}

/**
 * Deletes a gallery item based on the provided URL.
 * @param {string} url - The URL of the image to be deleted.
 */
async function deleteGalleryItem(url) {
    try {
        const response = await fetch('/api/images/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ path: url }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error. Status: ${response.status}`);
        }

        toastr.success(t`Image deleted successfully.`);
    } catch (error) {
        console.error('Failed to delete the image:', error);
        toastr.error(t`Failed to delete the image. Check the console for details.`);
    }
}

/**
 * Sets the sort order for the gallery.
 * @param {string} order Sort order
 */
function setSortOrder(order) {
    const context = SillyTavern.getContext();
    context.extensionSettings.gallery.sort = order;
    context.saveSettingsDebounced();
}

/**
 * Retrieves the current sort order for the gallery.
 * @returns {string} The current sort order for the gallery.
 */
function getSortOrder() {
    return SillyTavern.getContext().extensionSettings.gallery.sort ?? defaultSettings.sort;
}

/**
 * Initializes a gallery using the provided items and sets up the drag-and-drop functionality.
 * It uses the nanogallery2 library to display the items and also initializes
 * event listeners to handle drag-and-drop of files onto the gallery.
 *
 * @param {Array<Object>} items - An array of objects representing the items to display in the gallery.
 * @param {string} url - The URL to use when a file is dropped onto the gallery for uploading.
 * @returns {Promise<void>} - Promise representing the completion of the gallery initialization.
 */
async function initGallery(items, url) {
    const nonce = `nonce-${Math.random().toString(36).substring(2, 15)}`;
    const gallery = $('#dragGallery');
    gallery.addClass(nonce);
    gallery.nanogallery2({
        'items': items,
        thumbnailWidth: 'auto',
        thumbnailHeight: thumbnailHeight,
        paginationVisiblePages: paginationVisiblePages,
        paginationMaxLinesPerPage: paginationMaxLinesPerPage,
        galleryMaxRows: galleryMaxRows,
        galleryPaginationTopButtons: false,
        galleryNavigationOverlayButtons: true,
        galleryTheme: {
            navigationBar: { background: 'none', borderTop: '', borderBottom: '', borderRight: '', borderLeft: '' },
            navigationBreadcrumb: { background: '#111', color: '#fff', colorHover: '#ccc', borderRadius: '4px' },
            navigationFilter: { color: '#ddd', background: '#111', colorSelected: '#fff', backgroundSelected: '#111', borderRadius: '4px' },
            navigationPagination: { background: '#111', color: '#fff', colorHover: '#ccc', borderRadius: '4px' },
            thumbnail: { background: '#444', backgroundImage: 'linear-gradient(315deg, #111 0%, #445 90%)', borderColor: '#000', borderRadius: '0px', labelOpacity: 1, labelBackground: 'rgba(34, 34, 34, 0)', titleColor: '#fff', titleBgColor: 'transparent', titleShadow: '', descriptionColor: '#ccc', descriptionBgColor: 'transparent', descriptionShadow: '', stackBackground: '#aaa' },
            thumbnailIcon: { padding: '5px', color: '#fff', shadow: '' },
            pagination: { background: '#181818', backgroundSelected: '#666', color: '#fff', borderRadius: '2px', shapeBorder: '3px solid var(--SmartThemeQuoteColor)', shapeColor: '#444', shapeSelectedColor: '#aaa' },
        },
        galleryDisplayMode: 'pagination',
        fnThumbnailOpen: viewWithDragbox,
        fnThumbnailInit: function (/** @type {JQuery<HTMLElement>} */ $thumbnail, /** @type {{src: string}} */ item) {
            if (!item?.src) return;
            $thumbnail.attr('title', String(item.src).split('/').pop());
        },
    });

    const dragDropHandler = new DragAndDropHandler(`#dragGallery.${nonce}`, async (files) => {
        if (!Array.isArray(files) || files.length === 0) {
            return;
        }

        // Upload each file
        for (const file of files) {
            await uploadFile(file, url);
        }

        // Refresh the gallery
        const newItems = await getGalleryItems(url);
        $('#dragGallery').closest('#gallery').remove();
        await makeMovable(url);
        await delay(100);
        await initGallery(newItems, url);
    });

    const resizeHandler = function () {
        gallery.nanogallery2('resize');
    };

    eventSource.on('resizeUI', resizeHandler);

    eventSource.once(event_types.CHAT_CHANGED, function () {
        gallery.closest('#gallery').remove();
    });

    eventSource.once(CUSTOM_GALLERY_REMOVED_EVENT, function () {
        gallery.nanogallery2('destroy');
        dragDropHandler.destroy();
        eventSource.removeListener('resizeUI', resizeHandler);
    });

    // Set dropzone height to be the same as the parent
    gallery.css('height', gallery.parent().css('height'));

    //let images populate first
    await delay(100);
    //unset the height (which must be getting set by the gallery library at some point)
    gallery.css('height', 'unset');
    //force a resize to make images display correctly
    gallery.nanogallery2('resize');
}

/**
 * Displays a character gallery using the nanogallery2 library.
 *
 * This function takes care of:
 * - Loading necessary resources for the gallery on the first invocation.
 * - Preparing gallery items based on the character or group selection.
 * - Handling the drag-and-drop functionality for image upload.
 * - Displaying the gallery in a popup.
 * - Cleaning up resources when the gallery popup is closed.
 *
 * @returns {Promise<void>} - Promise representing the completion of the gallery display process.
 */
async function showCharGallery(deleteModeState = false) {
    // Load necessary files if it's the first time calling the function
    if (firstTime) {
        await loadFileToDocument(
            `${extensionFolderPath}nanogallery2.woff.min.css`,
            'css',
        );
        await loadFileToDocument(
            `${extensionFolderPath}jquery.nanogallery2.min.js`,
            'js',
        );
        firstTime = false;
        toastr.info('Images can also be found in the folder `user/images`', 'Drag and drop images onto the gallery to upload them', { timeOut: 6000 });
    }

    try {
        deleteModeActive = deleteModeState;
        let url = selected_group || this_chid;
        if (!selected_group && this_chid !== undefined) {
            url = getGalleryFolder(characters[this_chid]);
        }

        const items = await getGalleryItems(url);
        // if there already is a gallery, destroy it and place this one in its place
        $('#dragGallery').closest('#gallery').remove();
        await makeMovable(url);
        await delay(100);
        await initGallery(items, url);
    } catch (err) {
        console.trace();
        console.error(err);
    }
}

/**
 * Uploads a given file to a specified URL.
 * Once the file is uploaded, it provides a success message using toastr,
 * destroys the existing gallery, fetches the latest items, and reinitializes the gallery.
 *
 * @param {File} file - The file object to be uploaded.
 * @param {string} url - The URL indicating where the file should be uploaded.
 * @returns {Promise<void>} - Promise representing the completion of the file upload and gallery refresh.
 */
async function uploadFile(file, url) {
    try {
        // Convert the file to a base64 string
        const base64Data = await getBase64Async(file);

        // Create the payload
        const payload = {
            image: base64Data,
            ch_name: url,
        };

        const response = await fetch('/api/images/upload', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();

        toastr.success(t`File uploaded successfully. Saved at: ${result.path}`);
    } catch (error) {
        console.error('There was an issue uploading the file:', error);

        // Replacing alert with toastr error notification
        toastr.error(t`Failed to upload the file.`);
    }
}

/**
 * Creates a new draggable container based on a template.
 * This function takes a template with the ID 'generic_draggable_template' and clones it.
 * The cloned element has its attributes set, a new child div appended, and is made visible on the body.
 * Additionally, it sets up the element to prevent dragging on its images.
 * @param {string} url - The URL of the image source.
 * @returns {Promise<void>} - Promise representing the completion of the draggable container creation.
 */
async function makeMovable(url) {
    console.debug('making new container from template');
    const id = 'gallery';
    const template = $('#generic_draggable_template').html();
    const newElement = $(template);
    newElement.css({ 'background-color': 'var(--SmartThemeBlurTintColor)', 'opacity': 0 });
    newElement.attr('forChar', id);
    newElement.attr('id', id);
    newElement.find('.drag-grabber').attr('id', `${id}header`);
    const dragTitle = newElement.find('.dragTitle');
    dragTitle.addClass('flex-container justifySpaceBetween alignItemsBaseline');
    const titleText = document.createElement('span');
    titleText.textContent = t`Image Gallery`;
    dragTitle.append(titleText);
    const sortSelect = document.createElement('select');
    sortSelect.classList.add('gallery-sort-select');

    for (const sort of Object.values(SORT)) {
        const option = document.createElement('option');
        option.value = sort.value;
        option.textContent = sort.label;
        sortSelect.appendChild(option);
    }

    sortSelect.addEventListener('change', async () => {
        const selectedOption = sortSelect.options[sortSelect.selectedIndex].value;
        setSortOrder(selectedOption);
        closeButton.trigger('click');
        await showCharGallery();
    });

    sortSelect.value = getSortOrder();
    dragTitle.append(sortSelect);

    // add no-scrollbar class to this element
    newElement.addClass('no-scrollbar');

    // get the close button and set its id and data-related-id
    const closeButton = newElement.find('.dragClose');
    closeButton.attr('id', `${id}close`);
    closeButton.attr('data-related-id', `${id}`);

    const topBarElement = document.createElement('div');
    topBarElement.classList.add('flex-container', 'alignItemsCenter');

    const onChangeFolder = async (/** @type {Event} */ e) => {
        if (e instanceof KeyboardEvent && e.key !== 'Enter') {
            return;
        }

        try {
            const newUrl = await getSanitizedFilename(galleryFolderInput.value);
            updateGalleryFolder(newUrl);
            closeButton.trigger('click');
            await showCharGallery();
            toastr.info(t`Gallery folder changed to ${newUrl}`);
            galleryFolderInput.value = newUrl;
        } catch (error) {
            console.error('Failed to change gallery folder:', error);
            toastr.error(error?.message || t`Unknown error`, t`Failed to change gallery folder`);
        }
    };

    const onRestoreFolder = async () => {
        try {
            restoreGalleryFolder();
            closeButton.trigger('click');
            await showCharGallery();
        } catch (error) {
            console.error('Failed to restore gallery folder:', error);
            toastr.error(error?.message || t`Unknown error`, t`Failed to restore gallery folder`);
        }
    };

    const galleryFolderInput = document.createElement('input');
    galleryFolderInput.type = 'text';
    galleryFolderInput.placeholder = t`Folder Name`;
    galleryFolderInput.title = t`Enter a folder name to change the gallery folder`;
    galleryFolderInput.value = url;
    galleryFolderInput.classList.add('text_pole', 'gallery-folder-input', 'flex1');
    galleryFolderInput.addEventListener('keyup', onChangeFolder);

    const galleryFolderAccept = document.createElement('div');
    galleryFolderAccept.classList.add('right_menu_button', 'fa-solid', 'fa-check', 'fa-fw');
    galleryFolderAccept.title = t`Change gallery folder`;
    galleryFolderAccept.addEventListener('click', onChangeFolder);

    const galleryDeleteMode = document.createElement('div');
    galleryDeleteMode.classList.add('right_menu_button', 'fa-solid', 'fa-trash', 'fa-fw');
    galleryDeleteMode.classList.toggle('warning', deleteModeActive);
    galleryDeleteMode.title = t`Delete mode`;
    galleryDeleteMode.addEventListener('click', () => {
        deleteModeActive = !deleteModeActive;
        galleryDeleteMode.classList.toggle('warning', deleteModeActive);
        if (deleteModeActive) {
            toastr.info(t`Delete mode is ON. Click on images you want to delete.`);
        }
    });

    const galleryFolderRestore = document.createElement('div');
    galleryFolderRestore.classList.add('right_menu_button', 'fa-solid', 'fa-recycle', 'fa-fw');
    galleryFolderRestore.title = t`Restore gallery folder`;
    galleryFolderRestore.addEventListener('click', onRestoreFolder);

    topBarElement.appendChild(galleryFolderInput);
    topBarElement.appendChild(galleryFolderAccept);
    topBarElement.appendChild(galleryDeleteMode);
    topBarElement.appendChild(galleryFolderRestore);
    newElement.append(topBarElement);

    // Populate the gallery folder input with a list of available folders
    const folders = await getGalleryFolders();
    $(galleryFolderInput)
        .autocomplete({
            source: (i, o) => {
                const term = i.term.toLowerCase();
                const filtered = folders.filter(f => f.toLowerCase().includes(term));
                o(filtered);
            },
            select: (e, u) => {
                galleryFolderInput.value = u.item.value;
                onChangeFolder(e);
            },
            minLength: 0,
        })
        .on('focus', () => $(galleryFolderInput).autocomplete('search', ''));

    //add a div for the gallery
    newElement.append('<div id="dragGallery"></div>');

    $('#dragGallery').css('display', 'block');

    $('#movingDivs').append(newElement);

    loadMovingUIState();
    $(`.draggable[forChar="${id}"]`).css('display', 'block');
    dragElement(newElement);
    newElement.transition({
        opacity: 1,
        duration: animation_duration,
        easing: animation_easing,
    });

    $(`.draggable[forChar="${id}"] img`).on('dragstart', (e) => {
        console.log('saw drag on avatar!');
        e.preventDefault();
        return false;
    });
}

/**
 * Sets the gallery folder to a new URL.
 * @param {string} newUrl - The new URL to set for the gallery folder.
 */
function updateGalleryFolder(newUrl) {
    if (!newUrl) {
        throw new Error('Folder name cannot be empty');
    }
    const context = SillyTavern.getContext();
    if (context.groupId) {
        throw new Error('Cannot change gallery folder in group chat');
    }
    if (context.characterId === undefined) {
        throw new Error('Character is not selected');
    }
    const avatar = context.characters[context.characterId]?.avatar;
    const name = context.characters[context.characterId]?.name;
    if (!avatar) {
        throw new Error('Character PNG ID is not found');
    }
    if (newUrl === name) {
        // Default folder name is picked, remove the override
        delete context.extensionSettings.gallery.folders[avatar];
    } else {
        // Custom folder name is provided, set the override
        context.extensionSettings.gallery.folders[avatar] = newUrl;
    }
    context.saveSettingsDebounced();
}

/**
 * Restores the gallery folder to the default value.
 */
function restoreGalleryFolder() {
    const context = SillyTavern.getContext();
    if (context.groupId) {
        throw new Error('Cannot change gallery folder in group chat');
    }
    if (context.characterId === undefined) {
        throw new Error('Character is not selected');
    }
    const avatar = context.characters[context.characterId]?.avatar;
    if (!avatar) {
        throw new Error('Character PNG ID is not found');
    }
    const existingOverride = context.extensionSettings.gallery.folders[avatar];
    if (!existingOverride) {
        throw new Error('No folder override found');
    }
    delete context.extensionSettings.gallery.folders[avatar];
    context.saveSettingsDebounced();
}

/**
 * Creates a new draggable image based on a template.
 *
 * This function clones a provided template with the ID 'generic_draggable_template',
 * appends the given image URL, ensures the element has a unique ID,
 * and attaches the element to the body. After appending, it also prevents
 * dragging on the appended image.
 *
 * @param {string} id - A base identifier for the new draggable element.
 * @param {string} url - The URL of the image to be added to the draggable element.
 */
function makeDragImg(id, url) {
    // Step 1: Clone the template content
    const template = document.getElementById('generic_draggable_template');

    if (!(template instanceof HTMLTemplateElement)) {
        console.error('The element is not a <template> tag');
        return;
    }

    const newElement = document.importNode(template.content, true);

    // Step 2: Append the given image
    const imgElem = document.createElement('img');
    imgElem.src = url;
    let uniqueId = `draggable_${id}`;
    const draggableElem = /** @type {HTMLElement} */ (newElement.querySelector('.draggable'));
    if (draggableElem) {
        draggableElem.appendChild(imgElem);

        // Find a unique id for the draggable element

        let counter = 1;
        while (document.getElementById(uniqueId)) {
            uniqueId = `draggable_${id}_${counter}`;
            counter++;
        }
        draggableElem.id = uniqueId;

        // Ensure that the newly added element is displayed as block
        draggableElem.style.display = 'block';
        //and has no padding unlike other non-zoomed-avatar draggables
        draggableElem.style.padding = '0';

        // Add an id to the close button
        // If the close button exists, set related-id
        const closeButton = /** @type {HTMLElement} */ (draggableElem.querySelector('.dragClose'));
        if (closeButton) {
            closeButton.id = `${uniqueId}close`;
            closeButton.dataset.relatedId = uniqueId;
        }

        // Find the .drag-grabber and set its matching unique ID
        const dragGrabber = draggableElem.querySelector('.drag-grabber');
        if (dragGrabber) {
            dragGrabber.id = `${uniqueId}header`; // appending _header to make it match the parent's unique ID
        }
    }

    // Step 3: Attach it to the movingDivs container
    document.getElementById('movingDivs').appendChild(newElement);

    // Step 4: Call dragElement and loadMovingUIState
    const appendedElement = document.getElementById(uniqueId);
    if (appendedElement) {
        var elmntName = $(appendedElement);
        loadMovingUIState();
        dragElement(elmntName);

        // Prevent dragging the image
        $(`#${uniqueId} img`).on('dragstart', (e) => {
            console.log('saw drag on avatar!');
            e.preventDefault();
            return false;
        });
    } else {
        console.error('Failed to append the template content or retrieve the appended content.');
    }
}

/**
 * Sanitizes a given ID to ensure it can be used as an HTML ID.
 * This function replaces spaces and non-word characters with dashes.
 * It also removes any non-ASCII characters.
 * @param {string} id - The ID to be sanitized.
 * @returns {string} - The sanitized ID.
 */
function sanitizeHTMLId(id) {
    // Replace spaces and non-word characters
    id = id.replace(/\s+/g, '-')
        .replace(/[^\x00-\x7F]/g, '-')
        .replace(/\W/g, '');

    return id;
}

/**
 * Processes a list of items (containing URLs) and creates a draggable box for the first item.
 *
 * If the provided list of items is non-empty, it takes the URL of the first item,
 * derives an ID from the URL, and uses the makeDragImg function to create
 * a draggable image element based on that ID and URL.
 *
 * @param {Array} items - A list of items where each item has a responsiveURL method that returns a URL.
 */
function viewWithDragbox(items) {
    if (items && items.length > 0) {
        const url = items[0].responsiveURL(); // Get the URL of the clicked image/video
        if (deleteModeActive) {
            Popup.show.confirm(t`Are you sure you want to delete this image?`, url)
                .then(async (confirmed) => {
                    if (!confirmed) {
                        return;
                    }
                    deleteGalleryItem(url).then(() => showCharGallery(deleteModeActive));
                });
        } else {
            // ID should just be the last part of the URL, removing the extension
            const id = sanitizeHTMLId(url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('.')));
            makeDragImg(id, url);
        }
    }
}


// Registers a simple command for opening the char gallery.
SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'show-gallery',
    aliases: ['sg'],
    callback: () => {
        showCharGallery();
        return '';
    },
    helpString: 'Shows the gallery.',
}));
SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'list-gallery',
    aliases: ['lg'],
    callback: listGalleryCommand,
    returns: 'list of images',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'char',
            description: 'character name',
            typeList: [ARGUMENT_TYPE.STRING],
            enumProvider: commonEnumProviders.characters('character'),
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'group',
            description: 'group name',
            typeList: [ARGUMENT_TYPE.STRING],
            enumProvider: commonEnumProviders.characters('group'),
        }),
    ],
    helpString: 'List images in the gallery of the current char / group or a specified char / group.',
}));

async function listGalleryCommand(args) {
    try {
        let url = args.char ?? (args.group ? groups.find(it => it.name == args.group)?.id : null) ?? (selected_group || this_chid);
        if (!args.char && !args.group && !selected_group && this_chid !== undefined) {
            url = getGalleryFolder(characters[this_chid]);
        }

        const items = await getGalleryItems(url);
        return JSON.stringify(items.map(it => it.src));

    } catch (err) {
        console.trace();
        console.error(err);
    }
    return JSON.stringify([]);
}

// On extension load, ensure the settings are initialized
(function () {
    initSettings();
    eventSource.on(event_types.CHARACTER_RENAMED, (oldAvatar, newAvatar) => {
        const context = SillyTavern.getContext();
        const galleryFolder = context.extensionSettings.gallery.folders[oldAvatar];
        if (galleryFolder) {
            context.extensionSettings.gallery.folders[newAvatar] = galleryFolder;
            delete context.extensionSettings.gallery.folders[oldAvatar];
            context.saveSettingsDebounced();
        }
    });
    eventSource.on(event_types.CHARACTER_DELETED, (data) => {
        const avatar = data?.character?.avatar;
        if (!avatar) return;
        const context = SillyTavern.getContext();
        delete context.extensionSettings.gallery.folders[avatar];
        context.saveSettingsDebounced();
    });
    eventSource.on(event_types.CHARACTER_MANAGEMENT_DROPDOWN, (selectedOptionId) => {
        if (selectedOptionId === 'show_char_gallery') {
            showCharGallery();
        }
    });

    // Add an option to the dropdown
    $('#char-management-dropdown').append(
        $('<option>', {
            id: 'show_char_gallery',
            text: translate('Show Gallery'),
        }),
    );
})();
