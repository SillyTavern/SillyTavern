"use strict";

import {characters, event_types, eventSource, getOneCharacter} from "../script.js";
import {favsToHotswap} from "./RossAscends-mods.js";

/**
 * Implement a SingletonPattern, allowing access to the group overlay instance
 * from everywhere via (new CharacterGroupOverlay())
 *
 * @type CharacterGroupOverlay
 */
let characterGroupOverlayInstance = null;

class CharacterGroupOverlayState {
    static browse = 0;
    static select = 1;
}

class CharacterContextMenu {
    static toggleFavorite = (characterId) => {
        const character = CharacterContextMenu.getCharacter(characterId);
        const data = {
            name: character.name,
            avatar:  character.avatar,
            data: {
                extensions: {
                    fav: !character.data.extensions.fav
                }
            }
        };

        jQuery.ajax({
            type: "POST",
            url: '/v2/editcharacterattribute',
            data: JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            cache: false,
            processData: false,
            success: () =>
                getOneCharacter(character.avatar)
                .then(() =>
                        favsToHotswap()
                        .then(() => eventSource.emit(event_types.CHARACTER_EDITED, { detail: { id: character.id, character: characters[character.id] } })
                        )),
            error: response => toastr.error('Character not saved. Error: ' + response.responseJSON?.message),
        });
    }

    static getCharacter = (characterId) => characters[characterId] ?? null;

    static show = (positionX, positionY) => {
        let contextMenu = document.getElementById(CharacterGroupOverlay.contextMenuId);
        contextMenu.style.left = `${positionX}px`;
        contextMenu.style.top = `${positionY}px`;

        document.getElementById(CharacterGroupOverlay.contextMenuId).classList.remove('hidden');
    }

    static hide = () => document.getElementById(CharacterGroupOverlay.contextMenuId).classList.add('hidden');

    constructor(characterGroupOverlay) {
        const contextMenuItems = [
            {id: 'character_context_menu_favorite', callback: characterGroupOverlay.handleContextMenuFavorite}
        ];

        contextMenuItems.forEach(contextMenuItem => document.getElementById(contextMenuItem.id).addEventListener('click', contextMenuItem.callback))
    }
}

class CharacterGroupOverlay {
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
        if (characterGroupOverlayInstance instanceof CharacterGroupOverlay)
            return characterGroupOverlayInstance

        this.container = document.getElementById(CharacterGroupOverlay.containerId);
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
        const grid = document.getElementById(CharacterGroupOverlay.containerId);

        const sortable = new Sortable(grid, {
            group: 'shared',
            animation: 150,
            sort: false,
            handle: '.character_select',
            onEnd: (evt) => {
                if (evt.from !== evt.to) {
                    console.log('Folder creation request')
                }
            }
        });

        const elements = [...document.getElementsByClassName(CharacterGroupOverlay.characterClass)];

        elements.forEach(element => element.addEventListener('touchstart', this.handleHold));
        elements.forEach(element => element.addEventListener('mousedown', this.handleHold));

        elements.forEach(element => element.addEventListener('touchend', this.handleLongPressEnd));
        elements.forEach(element => element.addEventListener('mouseup', this.handleLongPressEnd));
        elements.forEach(element => element.addEventListener('dragend', this.handleLongPressEnd));

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

    handleHold = () => {
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
                this.container.classList.remove(CharacterGroupOverlay.selectModeClass);
                [...this.container.getElementsByClassName(CharacterGroupOverlay.characterClass)]
                    .forEach(element => element.removeEventListener('click', this.toggleCharacterSelected));
                this.clearSelectedCharacters();
                this.disableContextMenu();
                CharacterContextMenu.hide();
                break;
            case CharacterGroupOverlayState.select:
                this.container.classList.add(CharacterGroupOverlay.selectModeClass);
                [...this.container.getElementsByClassName(CharacterGroupOverlay.characterClass)]
                    .forEach(element => element.addEventListener('click', this.toggleCharacterSelected));
                this.enableContextMenu();
                break;
        }

        this.stateChangeCallbacks.forEach(callback => callback(this.state));
    }

    toggleCharacterSelected = event => {
        event.stopPropagation();

        const character = event.currentTarget;
        const characterId = character.getAttribute('chid');

        const alreadySelected = this.selectedCharacters.includes(characterId)

        if (alreadySelected) {
            character.classList.remove(CharacterGroupOverlay.selectedClass);
            this.dismissCharacter(characterId);
        } else {
            character.classList.add(CharacterGroupOverlay.selectedClass);
            this.selectCharacter(characterId);
        }
    }

    handleContextMenuShow = (event) => {
        event.preventDefault();
        document.getElementById(CharacterGroupOverlay.containerId).style.pointerEvents = 'none';
        CharacterContextMenu.show(event.clientX, event.clientY);
    }

    handleContextMenuHide = (event) => {
        document.getElementById(CharacterGroupOverlay.containerId).style.pointerEvents = '';
        let contextMenu = document.getElementById(CharacterGroupOverlay.contextMenuId);
        if (false === contextMenu.contains(event.target)) {
            CharacterContextMenu.hide();
        }
    }

    handleContextMenuFavorite = () => this.selectedCharacters.forEach(characterId => CharacterContextMenu.toggleFavorite(characterId));

    addStateChangeCallback = callback => this.stateChangeCallbacks.push(callback);

    selectCharacter = characterId => this.selectedCharacters.push(String(characterId));

    dismissCharacter = characterId => this.#selectedCharacters = this.selectedCharacters.filter(item => String(characterId) !== item);

    clearSelectedCharacters = () => {
        this.selectedCharacters.forEach(characterId => document.querySelector('.character_select[chid="' + characterId + '"]')?.classList.remove(CharacterGroupOverlay.selectedClass))
        this.selectedCharacters.length = 0;
    }
}

export {CharacterGroupOverlayState, CharacterContextMenu, CharacterGroupOverlay};
