import {
    eventSource,
    this_chid,
    characters,
    callPopup,
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
 * Displays a character gallery. The gallery is initialized using the nanogallery2 library. 
 * This function takes care of preparing the gallery items, loading necessary resources,
 * and ensuring body position is correctly set.
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
        if ($("body").css("position") === "fixed") {
            $("body").css("position", "static");
        }

        setTimeout(() => {
            $("#my-gallery").nanogallery2({
                items: items,
                thumbnailHeight: 150,
                thumbnailWidth: 150,
            });
        }, 100);

        close.then(() => {
            $("#my-gallery").nanogallery2("destroy");
            if ($("body").css("position") === "static") {
                $("body").css("position", "fixed");
            }
        });
    } catch (err) {
        console.error(err);
    }
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
