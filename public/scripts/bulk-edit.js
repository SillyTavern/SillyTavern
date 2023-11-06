import { characters, getCharacters, handleDeleteCharacter, callPopup } from "../script.js";
import {BulkEditOverlay, BulkEditOverlayState} from "./BulkEditOverlay.js";


let is_bulk_edit = false;

const enableBulkEdit = () => {
    enableBulkSelect();
    (new BulkEditOverlay()).selectState();
    // show the delete button
    $("#bulkDeleteButton").show();
    is_bulk_edit = true;
}

const disableBulkEdit = () => {
    disableBulkSelect();
    (new BulkEditOverlay()).browseState();
    // hide the delete button
    $("#bulkDeleteButton").hide();
    is_bulk_edit = false;
}

const toggleBulkEditMode = (isBulkEdit) => {
    if (isBulkEdit) {
        disableBulkEdit();
    } else {
        enableBulkEdit();
    }
}

(new BulkEditOverlay()).addStateChangeCallback((state) => {
    if (state === BulkEditOverlayState.select) enableBulkEdit();
    if (state === BulkEditOverlayState.browse) disableBulkEdit();
});

/**
 * Toggles bulk edit mode on/off when the edit button is clicked.
 */
function onEditButtonClick() {
    console.log("Edit button clicked");
    toggleBulkEditMode(is_bulk_edit);
}

/**
 * Deletes the character with the given chid.
 *
 * @param {string} this_chid - The chid of the character to delete.
 */
async function deleteCharacter(this_chid) {
    await handleDeleteCharacter("del_ch", this_chid, false);
}

/**
 * Deletes all characters that have been selected via the bulk checkboxes.
 */
async function onDeleteButtonClick() {
    console.log("Delete button clicked");

    // Create a mapping of chid to avatar
    let toDelete = [];
    $(".bulk_select_checkbox:checked").each((i, el) => {
        const chid = $(el).parent().attr("chid");
        const avatar = characters[chid].avatar;
        // Add the avatar to the list of avatars to delete
        toDelete.push(avatar);
    });

    const confirm = await callPopup('<h3>Are you sure you want to delete these characters?</h3>You would need to delete the chat files manually.<br>', 'confirm');

    if (!confirm) {
        console.log('User cancelled delete');
        return;
    }

    // Delete the characters
    for (const avatar of toDelete) {
        console.log(`Deleting character with avatar ${avatar}`);
        await getCharacters();

        //chid should be the key of the character with the given avatar
        const chid = Object.keys(characters).find((key) => characters[key].avatar === avatar);
        console.log(`Deleting character with chid ${chid}`);
        await deleteCharacter(chid);
    }
}

/**
 * Enables bulk selection by adding a checkbox next to each character.
 */
function enableBulkSelect() {
    $("#rm_print_characters_block .character_select").each((i, el) => {
        const character = $(el).text();
        const checkbox = $("<input type='checkbox' class='bulk_select_checkbox'>");
        checkbox.on("change", () => {
            // Do something when the checkbox is changed
        });
        $(el).prepend(checkbox);
    });
    $("#rm_print_characters_block").addClass("bulk_select");
    // We also need to disable the default click event for the character_select divs
    $(document).on("click", ".bulk_select_checkbox", function (event) {
        event.stopImmediatePropagation();
    });
}

/**
 * Disables bulk selection by removing the checkboxes.
 */
function disableBulkSelect() {
    $(".bulk_select_checkbox").remove();
    $("#rm_print_characters_block").removeClass("bulk_select");
}

/**
 * Entry point that runs on page load.
 */
jQuery(() => {
    $("#bulkEditButton").on("click", onEditButtonClick);
    $("#bulkDeleteButton").on("click", onDeleteButtonClick);
});
