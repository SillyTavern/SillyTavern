import {
    eventSource,
    this_chid,
    characters,
    callPopup,
    getRequestHeaders,
} from "../../../script.js";
import { selected_group } from "../../group-chats.js";
import { loadFileToDocument } from "../../utils.js";

const extensionName = "gallery";
const extensionFolderPath = `scripts/extensions/${extensionName}/`;
let firstTime = true;



/**
 * Retrieves a list of gallery items based on a given URL. This function calls an API endpoint 
 * to get the filenames and then constructs the item list.
 * 
 * @param {string} url - The base URL to retrieve the list of images.
 * @returns {Promise<Array>} - Resolves with an array of gallery item objects, rejects on error.
 */
async function getGalleryItems(url) {
    return new Promise((resolve, reject) => {
        $.get(`/listimgfiles/${url}`, function (files) {
            const items = files.map((file) => ({
                src: `user/images/${url}/${file}`,
                srct: `user/images/${url}/${file}`,
                title: "", // Optional title for each item
            }));
            resolve(items);
        }).fail(reject);
    });
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
    $("#my-gallery").nanogallery2({
        items: items,
        thumbnailHeight: 150,
        thumbnailWidth: 150,
    });

    // Initialize dropzone handlers
    const dropZone = $('#dialogue_popup');
    dropZone.on('dragover', function (e) {
        e.stopPropagation();  // Ensure this event doesn't propagate
        e.preventDefault();
        $(this).addClass('dragging');  // Add a CSS class to change appearance during drag-over
    });

    dropZone.on('dragleave', function (e) {
        e.stopPropagation();  // Ensure this event doesn't propagate
        $(this).removeClass('dragging');
    });

    dropZone.on('drop', function (e) {
        e.stopPropagation();  // Ensure this event doesn't propagate
        e.preventDefault();
        $(this).removeClass('dragging');
        let file = e.originalEvent.dataTransfer.files[0];
        uploadFile(file, url);  // Added url parameter to know where to upload
    });
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
            "css"
        );
        await loadFileToDocument(
            `${extensionFolderPath}jquery.nanogallery2.min.js`,
            "js"
        );
        firstTime = false;
    }

    try {
        let url = selected_group || this_chid;
        if (!selected_group && this_chid) {
            const char = characters[this_chid];
            url = char.avatar.replace(".png", "");
        }

        const items = await getGalleryItems(url);

        let close = callPopup('<div id="my-gallery"></div>', "text");
        console.log("close", close);
        if ($("body").css("position") === "fixed") {
            $("body").css("position", "static");
        }

        setTimeout(async () => {
            await initGallery(items, url); 
        }, 100);

        close.then(() => {
            $("#my-gallery").nanogallery2("destroy");
            if ($("body").css("position") === "static") {
                $("body").css("position", "fixed");
            }
            const dropZone = $('#dialogue_popup');
            dropZone.off('dragover dragleave drop');
        });
    } catch (err) {
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
            image: base64Data
        };

        // Add the ch_name from the provided URL (assuming it's the character name)
        payload.ch_name = url;

        try {
            const headers = await getRequestHeaders();

            // Merge headers with content-type for JSON
            Object.assign(headers, {
                'Content-Type': 'application/json'
            });

            const response = await fetch('/uploadimage', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();

            toastr.success('File uploaded successfully. Saved at: ' + result.path);

            // Refresh the gallery
            $("#my-gallery").nanogallery2("destroy");  // Destroy old gallery
            const newItems = await getGalleryItems(url);  // Fetch the latest items
            initGallery(newItems, url);  // Reinitialize the gallery with new items and pass 'url'


        } catch (error) {
            console.error("There was an issue uploading the file:", error);

            // Replacing alert with toastr error notification
            toastr.error('Failed to upload the file.');
        }
    }
    reader.readAsDataURL(file);
}

$(document).ready(function () {
    // Register an event listener
    eventSource.on("charManagementDropdown", (selectedOptionId) => {
        if (selectedOptionId === "show_char_gallery") {
            showCharGallery();
        }
    });

    // Add an option to the dropdown
    $("#char-management-dropdown").append(
        $("<option>", {
            id: "show_char_gallery",
            text: "Show Gallery",
        })
    );
});
