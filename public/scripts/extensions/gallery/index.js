import {
    eventSource, this_chid, characters, callPopup
} from "../../../script.js";
import { selected_group } from "../../group-chats.js";


function loadFile(url, type, callback) {
    return new Promise((resolve, reject) => {
        if (type === "css") {
            var link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = url;
            document.head.appendChild(link);
            link.onload = resolve;
            link.onerror = reject;
        } else if (type === "js") {
            var script = document.createElement("script");
            script.src = url;
            document.body.appendChild(script);
            script.onload = resolve;
            script.onerror = reject;
        }
    });
}

const extensionName = "gallery";
const extensionFolderPath = `scripts/extensions/${extensionName}/`;
let firstTime = true;

async function showCharGallery() {

    if (firstTime) {
        loadFile(`${extensionFolderPath}nanogallery2.woff.min.css`, "css")
            .then(() => {
                firstTime = false;
                return loadFile(`${extensionFolderPath}jquery.nanogallery2.min.js`, "js");
            })
    }

    console.trace('showCharGallery()');
    try {
        let selectedID = this_chid;
        let url = "";

        if (selected_group) {
            selectedID = selected_group;
            url = selectedID;
        }
        if (selectedID) {
            let char = characters[selectedID];
            let avatar = char.avatar;
            avatar = avatar.replace('.png', '');
            url = avatar;
        }

        const items = await getGalleryItems(url);

        // Create empty container for gallery and display popup
        let close = callPopup('<div id="my-gallery"></div>', 'text');
        if ($("body").css("position") === "fixed") {
            $("body").css("position", "static");
        }

        // Delayed initialization of nanogallery2
        setTimeout(() => {
            $("#my-gallery").nanogallery2({
                items: items,
                thumbnailHeight: 150,
                thumbnailWidth: 150,
            });
            console.log($("#my-gallery").children().length);
        }, 100);

        close.then(() => {
            $("#my-gallery").nanogallery2('destroy');
            if ($("body").css("position") === "static") {
                $("body").css("position", "fixed");
            }
        });

    } catch (err) {
        console.error(err);
    }
}


async function getGalleryItems(url) {
    return new Promise((resolve, reject) => {
        $.get(`/listimgfiles/${url}`, function (files) {
            const items = files.map(file => {
                let imgSrc = `user/images/${url}/${file}`;
                return {
                    src: imgSrc,
                    srct: imgSrc,
                    title: ''  // Or add a title if you wish
                };
            });
            resolve(items);
        }).fail(error => {
            reject(error);
        });
    });
}

jQuery(async () => { //wait for the page to load
    $(document).ready(function () {
        // Listen to the emitted event
        eventSource.on('charManagementDropdown', (selectedOptionId) => {
            console.log("Emitted event received with option ID:", selectedOptionId);

            if (selectedOptionId === "show_char_gallery") {
                showCharGallery();
            }
        });

        let newOption = $('<option>')
            .attr('id', 'show_char_gallery')
            .text('Show Gallery');

        $('#char-management-dropdown').append(newOption);
    });

});