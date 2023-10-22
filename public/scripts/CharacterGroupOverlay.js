"use strict";

import {event_types, eventSource} from "../script.js";

/**
 * Implement a SingletonPattern, allowing access to the group overlay instance
 * from everywhere via (new CharacterGroupOverlay())
 *
 * @type CharacterGroupOverlay
 */
let characterGroupOverlayInstance = null;

class State {
    static browse = 0;
    static select = 1;
}

class CharacterGroupOverlay {
    static containerId = 'rm_print_characters_block';
    static contextMenuClass = 'character_context_menu';
    static characterClass = 'character_select';
    static selectModeClass = 'group_overlay_mode_select';
    static selectedClass = 'character_selected';

    #state = State.browse;
    #longPress = false;
    #longPressEndCallbacks = [];
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

    get longPressEndCallbacks() {
        return this.#longPressEndCallbacks;
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

    browseState = () => this.state = State.browse;
    selectState = () => this.state = State.select;

    /**
     * Set up a Sortable grid for the loaded page
     */
    onPageLoad = () => {
        let touchState = false;
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

    handleHold = (event) => {
        this.isLongPress = true;
        setTimeout(() => {
            if (this.isLongPress) {
                this.state = State.select;
            }
        }, 3000);
    }

    handleLongPressEnd = () => {
        this.isLongPress = false;
    }

    handleCancelClick = () => {
        this.state = State.browse;
    }

    handleStateChange = () => {
        switch (this.state) {
            case State.browse:
                this.container.classList.remove(CharacterGroupOverlay.selectModeClass);
                [...this.container.getElementsByClassName(CharacterGroupOverlay.characterClass)]
                    .forEach(element => element.removeEventListener('click', this.toggleCharacterSelected));
                this.longPressEndCallbacks.forEach(callback => callback());
                this.clearSelectedCharacters();
                this.disableContextMenu();
                break;
            case State.select:
                this.container.classList.add(CharacterGroupOverlay.selectModeClass);
                [...this.container.getElementsByClassName(CharacterGroupOverlay.characterClass)]
                    .forEach(element => element.addEventListener('click', this.toggleCharacterSelected));
                this.enableContextMenu();
        }
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
        let contextMenu = document.getElementById(CharacterGroupOverlay.contextMenuClass);
        contextMenu.style.top = `${event.clientY}px`;
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.classList.remove('hidden');
    }

    handleContextMenuHide = (event) => {
        document.getElementById(CharacterGroupOverlay.containerId).style.pointerEvents = '';
        let contextMenu = document.getElementById(CharacterGroupOverlay.contextMenuClass);
        if (false === contextMenu.contains(event.target)) {
            contextMenu.classList.add('hidden');
        }
    }

    addLongPressEndCallback = callback => this.longPressEndCallbacks.push(callback);

    selectCharacter = characterId => this.selectedCharacters.push(String(characterId));

    dismissCharacter = characterId => this.#selectedCharacters = this.selectedCharacters.filter(item => String(characterId) !== item);

    clearSelectedCharacters = () => {
        this.selectedCharacters.forEach(characterId => document.querySelector('.character_select[chid="' + characterId + '"]')?.classList.remove(CharacterGroupOverlay.selectedClass))
        this.selectedCharacters.length = 0;
    }
}

export {CharacterGroupOverlay};
