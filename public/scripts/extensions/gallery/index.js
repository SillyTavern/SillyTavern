import {
    eventSource,
    this_chid,
    characters,
    getRequestHeaders,
    event_types,
} from '../../../script.js';
import { groups, selected_group } from '../../group-chats.js';
import { loadFileToDocument, delay } from '../../utils.js';
import { loadMovingUIState } from '../../power-user.js';
import { dragElement } from '../../RossAscends-mods.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { DragAndDropHandler } from '../../dragdrop.js';
import { commonEnumProviders } from '../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { translate } from '../../i18n.js';

const extensionName = 'gallery';
const extensionFolderPath = `scripts/extensions/${extensionName}/`;
let firstTime = true;

// Exposed defaults for future tweaking
let thumbnailHeight = 150;
let paginationVisiblePages = 10;
let paginationMaxLinesPerPage = 2;
let galleryMaxRows = 3;

$('body').on('click', '.dragClose', function () {
    const relatedId = $(this).data('related-id');  // Get the ID of the related draggable
    $(`body > .draggable[id="${relatedId}"]`).remove();  // Remove the associated draggable
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

/**
 * Retrieves a list of gallery items based on a given URL. This function calls an API endpoint
 * to get the filenames and then constructs the item list.
 *
 * @param {string} url - The base URL to retrieve the list of images.
 * @returns {Promise<Array>} - Resolves with an array of gallery item objects, rejects on error.
 */
async function getGalleryItems(url) {
    const response = await fetch(`/api/images/list/${url}`, {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    const data = await response.json();
    const items = data.map((file) => ({
        src: `user/images/${url}/${file}`,
        srct: `user/images/${url}/${file}`,
        title: '', // Optional title for each item
    }));

    return items;
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
    });

    const dragDropHandler = new DragAndDropHandler(`#dragGallery.${nonce}`, async (files, event) => {
        let file = files[0];
        uploadFile(file, url);  // Added url parameter to know where to upload
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
async function showCharGallery() {
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
        let url = selected_group || this_chid;
        if (!selected_group && this_chid) {
            const char = characters[this_chid];
            url = char.avatar.replace('.png', '');
        }

        const items = await getGalleryItems(url);
        // if there already is a gallery, destroy it and place this one in its place
        $('#dragGallery').closest('#gallery').remove();
        makeMovable();
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
    // Convert the file to a base64 string
    const reader = new FileReader();
    reader.onloadend = async function () {
        const base64Data = reader.result;

        // Create the payload
        const payload = {
            image: base64Data,
        };

        // Add the ch_name from the provided URL (assuming it's the character name)
        payload.ch_name = url;

        try {
            const headers = await getRequestHeaders();

            // Merge headers with content-type for JSON
            Object.assign(headers, {
                'Content-Type': 'application/json',
            });

            const response = await fetch('/api/images/upload', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();

            toastr.success('File uploaded successfully. Saved at: ' + result.path);

            // Refresh the gallery
            const newItems = await getGalleryItems(url);  // Fetch the latest items
            $('#dragGallery').closest('#gallery').remove();  // Destroy old gallery
            makeMovable();
            await delay(100);
            await initGallery(newItems, url);  // Reinitialize the gallery with new items and pass 'url'
        } catch (error) {
            console.error('There was an issue uploading the file:', error);

            // Replacing alert with toastr error notification
            toastr.error('Failed to upload the file.');
        }
    };
    reader.readAsDataURL(file);
}

$(document).ready(function () {
    // Register an event listener
    eventSource.on('charManagementDropdown', (selectedOptionId) => {
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
});

/**
 * Creates a new draggable container based on a template.
 * This function takes a template with the ID 'generic_draggable_template' and clones it.
 * The cloned element has its attributes set, a new child div appended, and is made visible on the body.
 * Additionally, it sets up the element to prevent dragging on its images.
 */
function makeMovable(id = 'gallery') {

    console.debug('making new container from template');
    const template = $('#generic_draggable_template').html();
    const newElement = $(template);
    newElement.css('background-color', 'var(--SmartThemeBlurTintColor)');
    newElement.attr('forChar', id);
    newElement.attr('id', `${id}`);
    newElement.find('.drag-grabber').attr('id', `${id}header`);
    newElement.find('.dragTitle').text('Image Gallery');
    //add a div for the gallery
    newElement.append('<div id="dragGallery"></div>');
    // add no-scrollbar class to this element
    newElement.addClass('no-scrollbar');

    // get the close button and set its id and data-related-id
    const closeButton = newElement.find('.dragClose');
    closeButton.attr('id', `${id}close`);
    closeButton.attr('data-related-id', `${id}`);

    $('#dragGallery').css('display', 'block');

    $('body').append(newElement);

    loadMovingUIState();
    $(`.draggable[forChar="${id}"]`).css('display', 'block');
    dragElement(newElement);

    $(`.draggable[forChar="${id}"] img`).on('dragstart', (e) => {
        console.log('saw drag on avatar!');
        e.preventDefault();
        return false;
    });
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
    const draggableElem = newElement.querySelector('.draggable');
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
        const closeButton = draggableElem.querySelector('.dragClose');
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

    // Step 3: Attach it to the body
    document.body.appendChild(newElement);

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
        // ID should just be the last part of the URL, removing the extension
        const id = sanitizeHTMLId(url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('.')));
        makeDragImg(id, url);
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
        if (!args.char && !args.group && !selected_group && this_chid) {
            const char = characters[this_chid];
            url = char.avatar.replace('.png', '');
        }

        const items = await getGalleryItems(url);
        return JSON.stringify(items.map(it => it.src));

    } catch (err) {
        console.trace();
        console.error(err);
    }
    return JSON.stringify([]);
}
