"use strict";

import {
    callPopup,
    characters,
    deleteCharacter,
    event_types,
    eventSource,
    getCharacters,
    getRequestHeaders,
    printCharacters,
    this_chid
} from "../script.js";

import { favsToHotswap } from "./RossAscends-mods.js";
import { hideLoader, showLoader } from "./loader.js";
import { convertCharacterToPersona } from "./personas.js";
import { createTagInput, getTagKeyForCharacter, tag_map } from "./tags.js";

// Utility object for popup messages.
const popupMessage = {
    deleteChat(characterCount) {
        return `<h3>Delete ${characterCount} characters?</h3>
                <b>THIS IS PERMANENT!<br><br>
                <label for="del_char_checkbox" class="checkbox_label justifyCenter">
                    <input type="checkbox" id="del_char_checkbox" />
                    <span>Also delete the chat files</span>
                </label><br></b>`;
    },
}

/**
 * Static object representing the actions of the
 * character context menu override.
 */
class CharacterContextMenu {
    /**
     * Tag one or more characters,
     * opens a popup.
     *
     * @param selectedCharacters
     */
    static tag = (selectedCharacters) => {
        BulkTagPopupHandler.show(selectedCharacters);
    }

    /**
     * Duplicate one or more characters
     *
     * @param characterId
     * @returns {Promise<Response>}
     */
    static duplicate = async (characterId) => {
        const character = CharacterContextMenu.#getCharacter(characterId);

        return fetch('/dupecharacter', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar_url: character.avatar }),
        });
    }

    /**
     * Favorite a character
     * and highlight it.
     *
     * @param characterId
     * @returns {Promise<void>}
     */
    static favorite = async (characterId) => {
        const character = CharacterContextMenu.#getCharacter(characterId);

        // Only set fav for V2 spec
        const data = {
            name: character.name,
            avatar: character.avatar,
            data: {
                extensions: {
                    fav: !character.data.extensions.fav
                }
            }
        };

        return fetch('/v2/editcharacterattribute', {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify(data),
        }).then((response) => {
            if (response.ok) {
                const element = document.getElementById(`CharID${characterId}`);
                element.classList.toggle('is_fav');
            } else {
                response.json().then(json => toastr.error('Character not saved. Error: ' + json.message + '. Field: ' + json.error));
            }
        });
    }

    /**
     * Convert one or more characters to persona,
     * may open a popup for one or more characters.
     *
     * @param characterId
     * @returns {Promise<void>}
     */
    static persona = async (characterId) => await convertCharacterToPersona(characterId);

    /**
     * Delete one or more characters,
     * opens a popup.
     *
     * @param characterId
     * @param deleteChats
     * @returns {Promise<void>}
     */
    static delete = async (characterId, deleteChats = false) => {
        const character = CharacterContextMenu.#getCharacter(characterId);

        return fetch('/deletecharacter', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar_url: character.avatar, delete_chats: deleteChats }),
            cache: 'no-cache',
        }).then(response => {
            if (response.ok) {
                deleteCharacter(character.name, character.avatar).then(() => {
                    if (deleteChats) {
                        fetch("/getallchatsofcharacter", {
                            method: 'POST',
                            body: JSON.stringify({ avatar_url: character.avatar }),
                            headers: getRequestHeaders(),
                        }).then((response) => {
                            let data = response.json();
                            data = Object.values(data);
                            const pastChats = data.sort((a, b) => a["file_name"].localeCompare(b["file_name"])).reverse();

                            for (const chat of pastChats) {
                                const name = chat.file_name.replace('.jsonl', '');
                                eventSource.emit(event_types.CHAT_DELETED, name);
                            }
                        });
                    }
                })
            }

            eventSource.emit('characterDeleted', { id: this_chid, character: characters[this_chid] });
        });
    }

    static #getCharacter = (characterId) => characters[characterId] ?? null;

    /**
     * Show the context menu at the given position
     *
     * @param positionX
     * @param positionY
     */
    static show = (positionX, positionY) => {
        let contextMenu = document.getElementById(BulkEditOverlay.contextMenuId);
        contextMenu.style.left = `${positionX}px`;
        contextMenu.style.top = `${positionY}px`;

        document.getElementById(BulkEditOverlay.contextMenuId).classList.remove('hidden');

        // Adjust position if context menu is outside of viewport
        const boundingRect = contextMenu.getBoundingClientRect();
        if (boundingRect.right > window.innerWidth) {
            contextMenu.style.left = `${positionX - (boundingRect.right - window.innerWidth)}px`;
        }
        if (boundingRect.bottom > window.innerHeight) {
            contextMenu.style.top = `${positionY - (boundingRect.bottom - window.innerHeight)}px`;
        }
    }

    /**
     * Hide the context menu
     */
    static hide = () => document.getElementById(BulkEditOverlay.contextMenuId).classList.add('hidden');

    /**
     * Sets up the context menu for the given overlay
     *
     * @param characterGroupOverlay
     */
    constructor(characterGroupOverlay) {
        const contextMenuItems = [
            { id: 'character_context_menu_favorite', callback: characterGroupOverlay.handleContextMenuFavorite },
            { id: 'character_context_menu_duplicate', callback: characterGroupOverlay.handleContextMenuDuplicate },
            { id: 'character_context_menu_delete', callback: characterGroupOverlay.handleContextMenuDelete },
            { id: 'character_context_menu_persona', callback: characterGroupOverlay.handleContextMenuPersona },
            { id: 'character_context_menu_tag', callback: characterGroupOverlay.handleContextMenuTag }
        ];

        contextMenuItems.forEach(contextMenuItem => document.getElementById(contextMenuItem.id).addEventListener('click', contextMenuItem.callback))
    }
}

/**
 * Represents a tag control not bound to a single character
 */
class BulkTagPopupHandler {
    static #getHtml = (characterIds) => {
        const characterData = JSON.stringify({ characterIds: characterIds });
        return `<div id="bulk_tag_shadow_popup">
            <div id="bulk_tag_popup">
                <div id="bulk_tag_popup_holder">
                <h3 class="m-b-1">Add tags to ${characterIds.length} characters</h3>
                <br>
                    <div id="bulk_tags_div" class="marginBot5" data-characters='${characterData}'>
                        <div class="tag_controls">
                            <input id="bulkTagInput" class="text_pole tag_input wide100p margin0" data-i18n="[placeholder]Search / Create Tags" placeholder="Search / Create tags" maxlength="25" />
                            <div class="tags_view menu_button fa-solid fa-tags" title="View all tags" data-i18n="[title]View all tags"></div>
                        </div>
                        <div id="bulkTagList" class="m-t-1 tags"></div>
                    </div>
                    <div id="dialogue_popup_controls" class="m-t-1">
                        <div id="bulk_tag_popup_cancel" class="menu_button" data-i18n="Cancel">Close</div>
                        <div id="bulk_tag_popup_reset" class="menu_button" data-i18n="Cancel">Remove all</div>
                    </div>
                </div>
            </div>
        </div>
    `
    };

    /**
     * Append and show the tag control
     *
     * @param characters - The characters assigned to this control
     */
    static show(characters) {
        document.body.insertAdjacentHTML('beforeend', this.#getHtml(characters));
        createTagInput('#bulkTagInput', '#bulkTagList');
        document.querySelector('#bulk_tag_popup_cancel').addEventListener('click', this.hide.bind(this));
        document.querySelector('#bulk_tag_popup_reset').addEventListener('click', this.resetTags.bind(this, characters));
    }

    /**
     * Hide and remove the tag control
     */
    static hide() {
        let popupElement = document.querySelector('#bulk_tag_shadow_popup');
        if (popupElement) {
            document.body.removeChild(popupElement);
        }

        printCharacters(true);
    }

    /**
     * Empty the tag map for the given characters
     *
     * @param characterIds
     */
    static resetTags(characterIds) {
        characterIds.forEach((characterId) => {
            const key = getTagKeyForCharacter(characterId);
            if (key) tag_map[key] = [];
        });

        printCharacters(true);
    }
}

class BulkEditOverlayState {
    /**
     *
     * @type {number}
     */
    static browse = 0;

    /**
     *
     * @type {number}
     */
    static select = 1;
}

/**
 * Implement a SingletonPattern, allowing access to the group overlay instance
 * from everywhere via (new CharacterGroupOverlay())
 *
 * @type BulkEditOverlay
 */
let bulkEditOverlayInstance = null;

class BulkEditOverlay {
    static containerId = 'rm_print_characters_block';
    static contextMenuId = 'character_context_menu';
    static characterClass = 'character_select';
    static groupClass = 'group_select';
    static bogusFolderClass = 'bogus_folder_select';
    static selectModeClass = 'group_overlay_mode_select';
    static selectedClass = 'character_selected';
    static legacySelectedClass = 'bulk_select_checkbox';

    static longPressDelay = 2500;

    #state = BulkEditOverlayState.browse;
    #longPress = false;
    #stateChangeCallbacks = [];
    #selectedCharacters = [];

    /**
     * Locks other pointer actions when the context menu is open
     *
     * @type {boolean}
     */
    #contextMenuOpen = false;

    /**
     * Whether the next character select should be skipped
     *
     * @type {boolean}
     */
    #cancelNextToggle = false;

    /**
     * @type HTMLElement
     */
    container = null;

    get state() {
        return this.#state;
    }

    set state(newState) {
        if (this.#state === newState) return;

        eventSource.emit(event_types.CHARACTER_GROUP_OVERLAY_STATE_CHANGE_BEFORE, newState)
            .then(() => {
                this.#state = newState;
                eventSource.emit(event_types.CHARACTER_GROUP_OVERLAY_STATE_CHANGE_AFTER, this.state)
            });
    }

    get isLongPress() {
        return this.#longPress;
    }

    set isLongPress(longPress) {
        this.#longPress = longPress;
    }

    get stateChangeCallbacks() {
        return this.#stateChangeCallbacks;
    }

    /**
     *
     * @returns {*[]}
     */
    get selectedCharacters() {
        return this.#selectedCharacters;
    }

    constructor() {
        if (bulkEditOverlayInstance instanceof BulkEditOverlay)
            return bulkEditOverlayInstance

        this.container = document.getElementById(BulkEditOverlay.containerId);

        eventSource.on(event_types.CHARACTER_GROUP_OVERLAY_STATE_CHANGE_AFTER, this.handleStateChange);
        bulkEditOverlayInstance = Object.freeze(this);
    }

    /**
     * Set the overlay to browse mode
     */
    browseState = () => this.state = BulkEditOverlayState.browse;

    /**
     * Set the overlay to select mode
     */
    selectState = () => this.state = BulkEditOverlayState.select;

    /**
     * Set up a Sortable grid for the loaded page
     */
    onPageLoad = () => {
        this.browseState();

        const elements = this.#getEnabledElements();
        elements.forEach(element => element.addEventListener('touchstart', this.handleHold));
        elements.forEach(element => element.addEventListener('mousedown', this.handleHold));
        elements.forEach(element => element.addEventListener('contextmenu', this.handleDefaultContextMenu));

        elements.forEach(element => element.addEventListener('touchend', this.handleLongPressEnd));
        elements.forEach(element => element.addEventListener('mouseup', this.handleLongPressEnd));
        elements.forEach(element => element.addEventListener('dragend', this.handleLongPressEnd));
        elements.forEach(element => element.addEventListener('touchmove', this.handleLongPressEnd));

        // Cohee: It only triggers when clicking on a margin between the elements?
        // Feel free to fix or remove this, I'm not sure how to.
        //this.container.addEventListener('click', this.handleCancelClick);
    }

    /**
     * Handle state changes
     *
     *
     */
    handleStateChange = () => {
        switch (this.state) {
            case BulkEditOverlayState.browse:
                this.container.classList.remove(BulkEditOverlay.selectModeClass);
                this.#contextMenuOpen = false;
                this.#enableClickEventsForCharacters();
                this.#enableClickEventsForGroups();
                this.clearSelectedCharacters();
                this.disableContextMenu();
                this.#disableBulkEditButtonHighlight();
                CharacterContextMenu.hide();
                break;
            case BulkEditOverlayState.select:
                this.container.classList.add(BulkEditOverlay.selectModeClass);
                this.#disableClickEventsForCharacters();
                this.#disableClickEventsForGroups();
                this.enableContextMenu();
                this.#enableBulkEditButtonHighlight();
                break;
        }

        this.stateChangeCallbacks.forEach(callback => callback(this.state));
    }

    /**
     * Block the browsers native context menu and
     * set a click event to hide the custom context menu.
     */
    enableContextMenu = () => {
        this.container.addEventListener('contextmenu', this.handleContextMenuShow);
        document.addEventListener('click', this.handleContextMenuHide);
    }

    /**
     * Remove event listeners, allowing the native browser context
     * menu to be opened.
     */
    disableContextMenu = () => {
        this.container.removeEventListener('contextmenu', this.handleContextMenuShow);
        document.removeEventListener('click', this.handleContextMenuHide);
    }

    handleDefaultContextMenu = (event) => {
        if (this.isLongPress) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    }

    /**
     * Opens menu on long-press.
     *
     * @param event - Pointer event
     */
    handleHold = (event) => {
        if (0 !== event.button && event.type !== 'touchstart') return;
        if (this.#contextMenuOpen) {
            this.#contextMenuOpen = false;
            this.#cancelNextToggle = true;
            CharacterContextMenu.hide();
            return;
        }

        let cancel = false;

        const cancelHold = (event) => cancel = true;
        this.container.addEventListener('mouseup', cancelHold);
        this.container.addEventListener('touchend', cancelHold);

        this.isLongPress = true;

        setTimeout(() => {
                if (this.isLongPress && !cancel) {
                    if (this.state === BulkEditOverlayState.browse) {
                        this.selectState();
                    } else if (this.state === BulkEditOverlayState.select) {
                        this.#contextMenuOpen = true;
                        CharacterContextMenu.show(...this.#getContextMenuPosition(event));
                    }
                }

                this.container.removeEventListener('mouseup', cancelHold);
                this.container.removeEventListener('touchend', cancelHold);
            },
            BulkEditOverlay.longPressDelay);
    }

    handleLongPressEnd = (event) => {
        this.isLongPress = false;
        if (this.#contextMenuOpen) event.stopPropagation();
    }

    handleCancelClick = () => {
        if (false === this.#contextMenuOpen) this.state = BulkEditOverlayState.browse;
        this.#contextMenuOpen = false;
    }

    /**
     * Returns the position of the mouse/touch location
     *
     * @param event
     * @returns {(boolean|number|*)[]}
     */
    #getContextMenuPosition = (event) => [
        event.clientX || event.touches[0].clientX,
        event.clientY || event.touches[0].clientY,
    ];

    #stopEventPropagation = (event) => {
        if (this.#contextMenuOpen) {
            this.handleContextMenuHide(event);
        }
        event.stopPropagation();
    }

    #enableClickEventsForGroups = () => this.#getDisabledElements().forEach((element) => element.removeEventListener('click', this.#stopEventPropagation));

    #disableClickEventsForGroups = () => this.#getDisabledElements().forEach((element) => element.addEventListener('click', this.#stopEventPropagation));

    #enableClickEventsForCharacters = () => this.#getEnabledElements().forEach(element => element.removeEventListener('click', this.toggleCharacterSelected));

    #disableClickEventsForCharacters = () => this.#getEnabledElements().forEach(element => element.addEventListener('click', this.toggleCharacterSelected));

    #enableBulkEditButtonHighlight = () => document.getElementById('bulkEditButton').classList.add('bulk_edit_overlay_active');

    #disableBulkEditButtonHighlight = () => document.getElementById('bulkEditButton').classList.remove('bulk_edit_overlay_active');

    #getEnabledElements = () => [...this.container.getElementsByClassName(BulkEditOverlay.characterClass)];

    #getDisabledElements = () =>[...this.container.getElementsByClassName(BulkEditOverlay.groupClass), ...this.container.getElementsByClassName(BulkEditOverlay.bogusFolderClass)];

    toggleCharacterSelected = event => {
        event.stopPropagation();

        const character = event.currentTarget;
        const characterId = character.getAttribute('chid');

        const alreadySelected = this.selectedCharacters.includes(characterId)

        const legacyBulkEditCheckbox = character.querySelector('.' + BulkEditOverlay.legacySelectedClass);

        // Only toggle when context menu is closed and wasn't just closed.
        if (!this.#contextMenuOpen && !this.#cancelNextToggle)
            if (alreadySelected) {
                character.classList.remove(BulkEditOverlay.selectedClass);
                if (legacyBulkEditCheckbox) legacyBulkEditCheckbox.checked = false;
                this.dismissCharacter(characterId);
            } else {
                character.classList.add(BulkEditOverlay.selectedClass)
                if (legacyBulkEditCheckbox) legacyBulkEditCheckbox.checked = true;
                this.selectCharacter(characterId);
            }

        this.#cancelNextToggle = false;
    }

    handleContextMenuShow = (event) => {
        event.preventDefault();
        CharacterContextMenu.show(...this.#getContextMenuPosition(event));
        this.#contextMenuOpen = true;
    }

    handleContextMenuHide = (event) => {
        let contextMenu = document.getElementById(BulkEditOverlay.contextMenuId);
        if (false === contextMenu.contains(event.target)) {
            CharacterContextMenu.hide();
        }
    }

    /**
     * Concurrently handle character favorite requests.
     *
     * @returns {Promise<number>}
     */
    handleContextMenuFavorite = () => Promise.all(this.selectedCharacters.map(async characterId => CharacterContextMenu.favorite(characterId)))
        .then(() => getCharacters())
        .then(() => favsToHotswap())
        .then(() => this.browseState())

    /**
     * Concurrently handle character duplicate requests.
     *
     * @returns {Promise<number>}
     */
    handleContextMenuDuplicate = () => Promise.all(this.selectedCharacters.map(async characterId => CharacterContextMenu.duplicate(characterId)))
        .then(() => getCharacters())
        .then(() => this.browseState())

    /**
     * Sequentially handle all character-to-persona conversions.
     *
     * @returns {Promise<void>}
     */
    handleContextMenuPersona = async () => {
        for (const characterId of this.selectedCharacters) {
            await CharacterContextMenu.persona(characterId)
        }

        this.browseState();
    }

    /**
     * Request user input before concurrently handle deletion
     * requests.
     *
     * @returns {Promise<number>}
     */
    handleContextMenuDelete = () => {
        callPopup(
            popupMessage.deleteChat(this.selectedCharacters.length), null)
            .then((accept) => {
                if (true !== accept) return;

                const deleteChats = document.getElementById('del_char_checkbox').checked ?? false;

                showLoader();
                toastr.info("We're deleting your characters, please wait...", 'Working on it');
                Promise.all(this.selectedCharacters.map(async characterId => CharacterContextMenu.delete(characterId, deleteChats)))
                    .then(() => getCharacters())
                    .then(() => this.browseState())
                    .finally(() => hideLoader());
            }
            );
    }

    /**
     * Attaches and opens the tag menu
     */
    handleContextMenuTag = () => {
        CharacterContextMenu.tag(this.selectedCharacters);
    }

    addStateChangeCallback = callback => this.stateChangeCallbacks.push(callback);

    selectCharacter = characterId => this.selectedCharacters.push(String(characterId));

    dismissCharacter = characterId => this.#selectedCharacters = this.selectedCharacters.filter(item => String(characterId) !== item);

    /**
     * Clears internal character storage and
     * removes visual highlight.
     */
    clearSelectedCharacters = () => {
        document.querySelectorAll('#' + BulkEditOverlay.containerId + ' .' + BulkEditOverlay.selectedClass)
            .forEach(element => element.classList.remove(BulkEditOverlay.selectedClass));
        this.selectedCharacters.length = 0;
    }
}

export { BulkEditOverlayState, CharacterContextMenu, BulkEditOverlay };
