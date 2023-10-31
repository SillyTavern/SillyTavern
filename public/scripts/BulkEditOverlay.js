"use strict";

import {
    callPopup,
    characters,
    deleteCharacter,
    event_types,
    eventSource,
    getCharacters,
    getRequestHeaders,
    saveSettings,
    settings
} from "../script.js";
import {favsToHotswap} from "./RossAscends-mods.js";
import {convertCharacterToPersona} from "./personas.js";
import {uuidv4} from "./utils.js";

const popupMessage = {
    deleteChat(characterCount) {
        return `<h3>Delete ${characterCount} characters?</h3>
                <b>THIS IS PERMANENT!<br><br>
                <label for="del_char_checkbox" class="checkbox_label justifyCenter">
                    <input type="checkbox" id="del_char_checkbox" />
                    <span>Also delete the chat files</span>
                </label><br></b>`;
    },
    newDeck() {
        return `<br/><p>Create a new character deck with the selected characters.</p>
                <h3>Set a name:</h3><br/>`;
    },
}

const toggleFavoriteHighlight = (characterId) => {
    const element = document.getElementById(`CharID${characterId}`);
    element.classList.toggle('is_fav');
}

/**
 * Defines a visual grouping of characters
 */
class CharacterDeck {
    id = '';
    name = '';

    /**  @type {int[]} */
    characters = [];

    constructor(id, name, characters = []) {
        this.id = id;
        this.name = name;
        this.characters = characters;

        return this;
    }

    addCharacter = (characterId) => {
        this.characters.push(characterId);

        return this;
    }

    static fromObject(obj) {
        return new CharacterDeck(obj.id, obj.name, obj.characters);
    }
}

/**
 * Represents the characterCollections setting
 */
class CharacterDeckCollection {
    /** @type {CharacterDeck[]} */
    decks = [];

    constructor(decks = []) {
        if (false === Array.isArray(decks) || decks.some(deck => !(deck instanceof CharacterDeck))) {
            throw new Error('All groups must be instances of CharacterGroup');
        }
        this.decks = decks;
    }

    addDeck = (deck) => {
        if (!(deck instanceof CharacterDeck)) {
            throw new Error('Group must be an instance of CharacterGroup');
        }
        this.decks.push(deck);

        return this;
    }

    static fromObject(object) {
        const decks = object.decks.map(deck => CharacterDeck.fromObject(deck));
        return new CharacterDeckCollection(decks);
    }
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

    static deck = (name = 'New Deck', characterIds = []) => {
        let characterDeckCollection = null;
        if (settings.characterDecks && Array.isArray(settings.characterDecks.decks)) {
            characterDeckCollection = CharacterDeckCollection.fromObject(settings.characterDecks);
        } else {
            characterDeckCollection = new CharacterDeckCollection();
        }

        const id = uuidv4();
        characterDeckCollection.addDeck(new CharacterDeck(id, name, characterIds));

        settings.characterDecks = JSON.parse(JSON.stringify(characterDeckCollection))
    }

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
            eventSource.emit('characterDeleted', { id: characterId, character: character });
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
            {id: 'character_context_menu_persona', callback: characterGroupOverlay.handleContextMenuPersona},
            {id: 'character_context_menu_deck', callback: characterGroupOverlay.handleContextMenuCreateDeck}
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

    handleContextMenuPersona = () =>  Promise.all(this.selectedCharacters.map(async characterId => CharacterContextMenu.persona(characterId)))
        .then(() => this.browseState());

    handleContextMenuDelete = () => {
        callPopup(
            popupMessage.deleteChat(this.selectedCharacters.length), null)
            .then(deleteChats =>
                Promise.all(this.selectedCharacters.map(async characterId => CharacterContextMenu.delete(characterId, deleteChats)))
                    .then(() => getCharacters())
                    .then(() => this.browseState())
            );
    }

    handleContextMenuCreateDeck = () => {
        callPopup(popupMessage.newDeck, 'input').then(
            (resolve) => {
                CharacterContextMenu.deck(resolve, this.selectedCharacters);
                saveSettings().then(async () => await getCharacters());
            }
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
