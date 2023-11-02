"use strict";

import {
    callPopup,
    characters, deleteCharacter,
    event_types,
    eventSource,
    getCharacters,
    getRequestHeaders, handleDeleteCharacter, this_chid
} from "../script.js";
import {favsToHotswap} from "./RossAscends-mods.js";
import {convertCharacterToPersona} from "./personas.js";

const popupMessage = {
    deleteChat(characterCount) {
        return `<h3>Delete ${characterCount} characters?</h3>
                <b>THIS IS PERMANENT!<br><br>
                <label for="del_char_checkbox" class="checkbox_label justifyCenter">
                    <input type="checkbox" id="del_char_checkbox" />
                    <span>Also delete the chat files</span>
                </label><br></b>`;
    },
    exportCharacters(characterCount) {
        return `<h3>Export ${characterCount} characters?</h3>`;
    }
}

const toggleFavoriteHighlight = (characterId) => {
    const element = document.getElementById(`CharID${characterId}`);
    element.classList.toggle('is_fav');
}

/**
 * Implement a SingletonPattern, allowing access to the group overlay instance
 * from everywhere via (new CharacterGroupOverlay())
 *
 * @type BulkEditOverlay
 */
let characterGroupOverlayInstance = null;

class CharacterGroupOverlayState {
    static browse = 0;
    static select = 1;
}

class CharacterContextMenu {
    /**
     * Duplicate a character
     *
     * @param characterId
     * @returns {Promise<Response>}
     */
    static duplicate = async (characterId) => {
        const character = CharacterContextMenu.getCharacter(characterId);

        return fetch('/dupecharacter', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar_url: character.avatar }),
        });
    }

    /**
     * Favorite a character
     * and toggle its ui element.
     *
     * @param characterId
     * @returns {Promise<void>}
     */
    static favorite = async (characterId) => {
        const character = CharacterContextMenu.getCharacter(characterId);
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
            if (response.ok) toggleFavoriteHighlight(characterId)
            else toastr.error('Character not saved. Error: ' + response.json()?.message)
        });
    }

    static persona = async (characterId) => convertCharacterToPersona(characterId);

    static delete = async (characterId, deleteChats = false) => {
        const character = CharacterContextMenu.getCharacter(characterId);

        return fetch('/deletecharacter', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar_url: character.avatar , delete_chats: deleteChats }),
            cache: 'no-cache',
        }).then(response => {
            if (response.ok) {
                deleteCharacter(character.name, character.avatar).then(() => {
                    if (deleteChats) {
                        fetch("/getallchatsofcharacter", {
                            method: 'POST',
                            body: JSON.stringify({ avatar_url: character.avatar }),
                            headers: getRequestHeaders(),
                        }).then( (response) => {
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

    static getCharacter = (characterId) => characters[characterId] ?? null;

    static show = (positionX, positionY) => {
        let contextMenu = document.getElementById(BulkEditOverlay.contextMenuId);
        contextMenu.style.left = `${positionX}px`;
        contextMenu.style.top = `${positionY}px`;

        document.getElementById(BulkEditOverlay.contextMenuId).classList.remove('hidden');
    }

    static hide = () => document.getElementById(BulkEditOverlay.contextMenuId).classList.add('hidden');

    constructor(characterGroupOverlay) {
        const contextMenuItems = [
            {id: 'character_context_menu_favorite', callback: characterGroupOverlay.handleContextMenuFavorite},
            {id: 'character_context_menu_duplicate', callback: characterGroupOverlay.handleContextMenuDuplicate},
            {id: 'character_context_menu_delete', callback: characterGroupOverlay.handleContextMenuDelete},
            {id: 'character_context_menu_persona', callback: characterGroupOverlay.handleContextMenuPersona}
        ];

        contextMenuItems.forEach(contextMenuItem => document.getElementById(contextMenuItem.id).addEventListener('click', contextMenuItem.callback))
    }
}

class BulkEditOverlay {
    static containerId = 'rm_print_characters_block';
    static contextMenuId = 'character_context_menu';
    static characterClass = 'character_select';
    static selectModeClass = 'group_overlay_mode_select';
    static selectedClass = 'character_selected';

    #state = CharacterGroupOverlayState.browse;
    #longPress = false;
    #stateChangeCallbacks = [];
    #selectedCharacters = [];

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

    get selectedCharacters() {
        return this.#selectedCharacters;
    }

    constructor() {
        if (characterGroupOverlayInstance instanceof BulkEditOverlay)
            return characterGroupOverlayInstance

        this.container = document.getElementById(BulkEditOverlay.containerId);
        this.container.addEventListener('click', this.handleCancelClick);

        eventSource.on(event_types.CHARACTER_GROUP_OVERLAY_STATE_CHANGE_AFTER, this.handleStateChange);
        characterGroupOverlayInstance = Object.freeze(this);
    }

    browseState = () => this.state = CharacterGroupOverlayState.browse;
    selectState = () => this.state = CharacterGroupOverlayState.select;

    /**
     * Set up a Sortable grid for the loaded page
     */
    onPageLoad = () => {
        this.browseState();

        const elements = [...document.getElementsByClassName(BulkEditOverlay.characterClass)];
        elements.forEach(element => element.addEventListener('touchstart', this.handleHold));
        elements.forEach(element => element.addEventListener('mousedown', this.handleHold));

        elements.forEach(element => element.addEventListener('touchend', this.handleLongPressEnd));
        elements.forEach(element => element.addEventListener('mouseup', this.handleLongPressEnd));
        elements.forEach(element => element.addEventListener('dragend', this.handleLongPressEnd));

        const grid = document.getElementById(BulkEditOverlay.containerId);
        grid.addEventListener('click', this.handleCancelClick);
    }

    /**
     * Block the browsers native context menu and
     * set a click event to hide the custom context menu.
     */
    enableContextMenu = () => {
        document.addEventListener('contextmenu', this.handleContextMenuShow);
        document.addEventListener('click', this.handleContextMenuHide);
    }

    /**
     * Remove event listeners, allowing the native browser context
     * menu to be opened.
     */
    disableContextMenu = () => {
        document.removeEventListener('contextmenu', this.handleContextMenuShow);
        document.removeEventListener('click', this.handleContextMenuHide);
    }

    handleHold = (event) => {
        if (0 !== event.button) return;

        this.isLongPress = true;
        setTimeout(() => {
            if (this.isLongPress) {
                this.state = CharacterGroupOverlayState.select;
            }
        }, 3000);
    }

    handleLongPressEnd = () => {
        this.isLongPress = false;
    }

    handleCancelClick = () => {
        this.state = CharacterGroupOverlayState.browse;
    }

    handleStateChange = () => {
        switch (this.state) {
            case CharacterGroupOverlayState.browse:
                this.container.classList.remove(BulkEditOverlay.selectModeClass);
                this.#enableClickEventsForCharacters();
                this.clearSelectedCharacters();
                this.disableContextMenu();
                this.#disableBulkEditButtonHighlight();
                CharacterContextMenu.hide();
                break;
            case CharacterGroupOverlayState.select:
                this.container.classList.add(BulkEditOverlay.selectModeClass);
                this.#disableClickEventsForCharacters();
                this.enableContextMenu();
                this.#enableBulkEditButtonHighlight();
                break;
        }

        this.stateChangeCallbacks.forEach(callback => callback(this.state));
    }

    #enableClickEventsForCharacters = () => [...this.container.getElementsByClassName(BulkEditOverlay.characterClass)]
        .forEach(element => element.removeEventListener('click', this.toggleCharacterSelected));

    #disableClickEventsForCharacters = () => [...this.container.getElementsByClassName(BulkEditOverlay.characterClass)]
        .forEach(element => element.addEventListener('click', this.toggleCharacterSelected));

    #enableBulkEditButtonHighlight = () => document.getElementById('bulkEditButton').classList.add('bulk_edit_overlay_active');

    #disableBulkEditButtonHighlight = () => document.getElementById('bulkEditButton').classList.remove('bulk_edit_overlay_active');

    toggleCharacterSelected = event => {
        event.stopPropagation();

        const character = event.currentTarget;
        const characterId = character.getAttribute('chid');

        const alreadySelected = this.selectedCharacters.includes(characterId)

        if (alreadySelected) {
            character.classList.remove(BulkEditOverlay.selectedClass);
            this.dismissCharacter(characterId);
        } else {
            character.classList.add(BulkEditOverlay.selectedClass);
            this.selectCharacter(characterId);
        }
    }

    handleContextMenuShow = (event) => {
        event.preventDefault();
        document.getElementById(BulkEditOverlay.containerId).style.pointerEvents = 'none';
        CharacterContextMenu.show(event.clientX, event.clientY);
    }

    handleContextMenuHide = (event) => {
        document.getElementById(BulkEditOverlay.containerId).style.pointerEvents = '';
        let contextMenu = document.getElementById(BulkEditOverlay.contextMenuId);
        if (false === contextMenu.contains(event.target)) {
            CharacterContextMenu.hide();
        }
    }

    handleContextMenuFavorite = () => Promise.all(this.selectedCharacters.map(async characterId => CharacterContextMenu.favorite(characterId)))
        .then(() => getCharacters())
        .then(() => favsToHotswap())
        .then(() => this.browseState())

    handleContextMenuDuplicate = () => Promise.all(this.selectedCharacters.map(async characterId => CharacterContextMenu.duplicate(characterId)))
        .then(() => getCharacters())
        .then(() => this.browseState())

    handleContextMenuPersona = () => { Promise.all(this.selectedCharacters.map(async characterId => CharacterContextMenu.persona(characterId)))
        .then(() => this.browseState());
    }

    handleContextMenuDelete = () => {
        callPopup(
            popupMessage.deleteChat(this.selectedCharacters.length), null)
            .then(deleteChats =>
                Promise.all(this.selectedCharacters.map(async characterId => CharacterContextMenu.delete(characterId, deleteChats)))
                    .then(() => getCharacters())
                    .then(() => this.browseState())
            );
    }

    addStateChangeCallback = callback => this.stateChangeCallbacks.push(callback);

    selectCharacter = characterId => this.selectedCharacters.push(String(characterId));

    dismissCharacter = characterId => this.#selectedCharacters = this.selectedCharacters.filter(item => String(characterId) !== item);

    clearSelectedCharacters = () => {
        this.selectedCharacters.forEach(characterId => document.querySelector('.character_select[chid="' + characterId + '"]')?.classList.remove(BulkEditOverlay.selectedClass))
        this.selectedCharacters.length = 0;
    }
}

export {CharacterGroupOverlayState, CharacterContextMenu, BulkEditOverlay};
