/**
 * Handles inline media (reference images, video, audio) for character cards.
 * These attachments are stored in character data extensions and can be sent
 * to multimodal models as additional context alongside character descriptions.
 */

import {
    characters,
    this_chid,
    eventSource,
    event_types,
    menu_type,
    create_save,
} from '../script.js';
import {
    getBase64Async,
    saveBase64AsFile,
    getStringHash,
    getFileExtension,
} from './utils.js';
import { writeExtensionField } from './extensions.js';
import { MEDIA_TYPE } from './constants.js';
import { t } from './i18n.js';
import { deleteMediaFromServer } from './chats.js';
import { renderTemplateAsync } from './templates.js';
import { POPUP_RESULT, POPUP_TYPE, callGenericPopup } from './popup.js';
import { DragAndDropHandler } from './dragdrop.js';

/**
 * @typedef {object} CharacterMediaAttachment
 * @property {string} url - Server-relative URL of the uploaded asset
 * @property {string} name - Original file name
 * @property {string} type - One of MEDIA_TYPE values: 'image', 'video', 'audio'
 * @property {number} created - Timestamp of when the asset was attached
 */

const EXTENSION_KEY = 'inline_media';
const PROMPT_KEY = 'inline_media_prompt';

/**
 * Whether the editor is currently in create-new-character mode.
 * @returns {boolean}
 */
function isCreateMode() {
    return menu_type === 'create';
}

/**
 * Gets the inline media array for the current character / pending create draft.
 * @returns {CharacterMediaAttachment[]}
 */
export function getCharacterInlineMedia() {
    if (isCreateMode()) {
        const arr = create_save.extensions?.[EXTENSION_KEY];
        return Array.isArray(arr) ? arr : [];
    }
    const character = characters[this_chid];
    if (!character?.data?.extensions?.[EXTENSION_KEY]) {
        return [];
    }
    return character.data.extensions[EXTENSION_KEY];
}

/**
 * Persists the inline media array for the current character / pending create draft.
 * In create mode, writes only to the in-memory `create_save.extensions` — the
 * server persists it later via the create form's `extensions` field.
 * @param {CharacterMediaAttachment[]} media
 */
async function setCharacterInlineMedia(media) {
    if (isCreateMode()) {
        if (!create_save.extensions || typeof create_save.extensions !== 'object') {
            create_save.extensions = {};
        }
        create_save.extensions[EXTENSION_KEY] = media;
        return;
    }
    await writeExtensionField(this_chid, EXTENSION_KEY, media);
}

/**
 * Gets the per-character body of the reference-media user message.
 * Empty string when unset, which means the message is sent with no body
 * (just attachments).
 * @returns {string}
 */
export function getCharacterInlineMediaPrompt() {
    if (isCreateMode()) {
        const value = create_save.extensions?.[PROMPT_KEY];
        return typeof value === 'string' ? value : '';
    }
    const character = characters[this_chid];
    const value = character?.data?.extensions?.[PROMPT_KEY];
    return typeof value === 'string' ? value : '';
}

/**
 * Persists the per-character override for the reference-media message body.
 * @param {string} value
 */
export async function setCharacterInlineMediaPrompt(value) {
    const next = value || '';
    if (isCreateMode()) {
        if (!create_save.extensions || typeof create_save.extensions !== 'object') {
            create_save.extensions = {};
        }
        create_save.extensions[PROMPT_KEY] = next;
        return;
    }
    if (this_chid === undefined) return;
    await writeExtensionField(this_chid, PROMPT_KEY, next);
}

/**
 * Uploads a media file (image / video / audio) and attaches it to the current character.
 * @param {File} file - The media file to upload
 * @returns {Promise<CharacterMediaAttachment|null>} The created attachment, or null on failure
 */
export async function attachMediaToCharacter(file) {
    const inCreate = isCreateMode();
    if (!inCreate && this_chid === undefined) {
        toastr.warning(t`No character selected.`);
        return null;
    }

    const character = inCreate ? null : characters[this_chid];
    if (!inCreate && !character) {
        return null;
    }

    const mediaType = MEDIA_TYPE.getFromMime(file.type);
    if (!mediaType) {
        toastr.warning(t`Unsupported file type. Reference attachments must be image, video, or audio.`);
        return null;
    }

    try {
        const base64 = await getBase64Async(file);
        const base64Data = base64.split(',')[1];
        const extension = getFileExtension(file);
        const slug = getStringHash(file.name);
        const fileName = `char_ref_${Date.now()}_${slug}`;
        const charName = inCreate
            ? (String($('#character_name_pole').val() || '').trim() || create_save.name || 'unknown')
            : (character.name || 'unknown');

        const url = await saveBase64AsFile(base64Data, charName, fileName, extension);

        /** @type {CharacterMediaAttachment} */
        const attachment = {
            url,
            name: file.name,
            type: mediaType,
            created: Date.now(),
        };

        const media = [...getCharacterInlineMedia(), attachment];
        await setCharacterInlineMedia(media);

        return attachment;
    } catch (error) {
        console.error('Failed to attach reference media to character', error);
        toastr.error(t`Failed to upload the file.`);
        return null;
    }
}

/**
 * Removes an inline media attachment from the character by index, both from the card's
 * extensions array and from disk under userImages. The asset is owned by exactly this
 * attachment entry — once unreferenced it would be orphaned. Best-effort: a failed
 * server-side delete still removes the entry from the card.
 * @param {number} index - Index in the inline_media array
 * @returns {Promise<void>}
 */
export async function removeCharacterInlineMedia(index) {
    const media = [...getCharacterInlineMedia()];
    if (index < 0 || index >= media.length) {
        console.warn('Invalid media index', index);
        return;
    }

    const [removed] = media.splice(index, 1);
    await setCharacterInlineMedia(media);

    if (removed?.url) {
        try {
            await deleteMediaFromServer(removed.url, /* silent */ true);
        } catch (error) {
            console.warn('Failed to delete inline_media asset from disk', removed.url, error);
        }
    }
}

/**
 * Builds a preview element for an attachment, dispatched on its media type.
 * Falls back to an image element for legacy entries that have no `type` field.
 * @param {CharacterMediaAttachment} attachment
 * @returns {JQuery<HTMLElement>}
 */
function buildPreviewElement(attachment) {
    const type = attachment.type ?? MEDIA_TYPE.IMAGE;
    if (type === MEDIA_TYPE.VIDEO) {
        return $('<video preload="metadata" muted playsinline></video>')
            .attr('src', attachment.url)
            .attr('aria-label', attachment.name);
    }
    if (type === MEDIA_TYPE.AUDIO) {
        return $('<audio preload="metadata" controls></audio>')
            .attr('src', attachment.url)
            .attr('aria-label', attachment.name);
    }
    return $('<img>')
        .attr('src', attachment.url)
        .attr('alt', attachment.name);
}

/**
 * Builds a fullscreen-popup element for an attachment, dispatched on its media type.
 * @param {CharacterMediaAttachment} attachment
 * @returns {JQuery<HTMLElement>}
 */
function buildFullPreviewElement(attachment) {
    const type = attachment.type ?? MEDIA_TYPE.IMAGE;
    const styles = { maxWidth: '100%', maxHeight: '80vh' };
    if (type === MEDIA_TYPE.VIDEO) {
        return $('<video controls autoplay></video>')
            .attr('src', attachment.url)
            .css(styles);
    }
    if (type === MEDIA_TYPE.AUDIO) {
        return $('<audio controls autoplay></audio>')
            .attr('src', attachment.url);
    }
    return $('<img>').attr('src', attachment.url).css(styles);
}

/**
 * Monotonic render counter — bumped at the start of each render so any
 * in-flight render whose async template fetch finishes after a newer one
 * started can detect it's stale and bail out (otherwise both `appendChild`
 * after their awaits, leaving the previous card's images visible).
 */
let renderSeq = 0;

/**
 * Renders the reference media UI in the character editor.
 */
export async function renderCharacterRefImages() {
    const container = document.getElementById('char_ref_images_container');
    if (!container) return;

    const mySeq = ++renderSeq;

    if (this_chid === undefined && !isCreateMode()) {
        container.replaceChildren();
        return;
    }

    const media = getCharacterInlineMedia();
    const template = $(await renderTemplateAsync('charRefImages'));

    if (mySeq !== renderSeq) return;

    const list = template.find('.char_ref_images_list');
    const countSpan = template.find('.char_ref_images_count');

    if (media.length > 0) {
        countSpan.text(`(${media.length})`);
    }

    for (let i = 0; i < media.length; i++) {
        const attachment = media[i];
        const item = $('<div class="char_ref_image_item"></div>');
        item.attr('title', attachment.name);
        item.attr('data-media-type', attachment.type ?? MEDIA_TYPE.IMAGE);

        item.append(buildPreviewElement(attachment));

        const deleteBtn = $('<button class="char_ref_image_delete"><i class="fa-solid fa-xmark"></i></button>');
        deleteBtn.on('click', async (e) => {
            e.stopPropagation();
            const confirm = await callGenericPopup(t`Remove this reference attachment?`, POPUP_TYPE.CONFIRM);
            if (confirm !== POPUP_RESULT.AFFIRMATIVE) return;
            await removeCharacterInlineMedia(i);
            await renderCharacterRefImages();
        });
        item.append(deleteBtn);

        // Click-to-enlarge — but don't hijack clicks on the embedded media controls
        // (e.g. play/pause for video & audio).
        item.on('click', function (event) {
            const target = /** @type {HTMLElement} */ (event.target);
            if (target && (target.closest('audio') || target.closest('video'))) return;
            callGenericPopup(buildFullPreviewElement(attachment), POPUP_TYPE.TEXT, '', { wide: true, large: true });
        });

        list.append(item);
    }

    const addBtn = template.find('.char_ref_images_add');
    const fileInput = template.find('.char_ref_images_input');

    addBtn.on('click', () => fileInput.trigger('click'));
    fileInput.on('change', async function () {
        if (!(this instanceof HTMLInputElement) || !this.files?.length) return;
        for (const file of this.files) {
            await attachMediaToCharacter(file);
        }
        if (this.files.length > 0) {
            toastr.success(t`${this.files.length} attachment(s) added as reference.`);
        }
        await renderCharacterRefImages();
    });

    // Per-character body for the user message that ships alongside the attachments.
    // Blank means no body text — the message is sent as pure attachments.
    const promptInput = template.find('.char_ref_images_prompt');
    promptInput.val(getCharacterInlineMediaPrompt());
    promptInput.on('change', async function () {
        if (!(this instanceof HTMLTextAreaElement)) return;
        await setCharacterInlineMediaPrompt(this.value);
    });

    container.replaceChildren(template.get(0));
}

/**
 * Wires paste + drag-drop on the Reference Media drawer container so users can paste
 * or drop image / video / audio files directly into the editor. Only consumes events
 * that carry supported media; pasting plain text into the prompt textarea passes through.
 * Idempotent — safe to call once at init.
 */
function setupRefImagesDropTarget() {
    const container = document.getElementById('char_ref_images_container');
    if (!container) return;

    const ingest = async (files) => {
        const supported = files.filter(f => MEDIA_TYPE.getFromMime(f.type) !== null);
        if (supported.length === 0) return;
        for (const file of supported) {
            await attachMediaToCharacter(file);
        }
        toastr.success(t`${supported.length} attachment(s) added as reference.`);
        await renderCharacterRefImages();
    };

    container.addEventListener('paste', (e) => {
        const clipboardEvent = /** @type {ClipboardEvent} */ (e);
        const files = clipboardEvent.clipboardData?.files;
        if (!files?.length) return;
        const fileArr = Array.from(files);
        if (!fileArr.some(f => MEDIA_TYPE.getFromMime(f.type) !== null)) return;
        clipboardEvent.preventDefault();
        clipboardEvent.stopPropagation();
        ingest(fileArr);
    });

    new DragAndDropHandler('#char_ref_images_container', (files) => {
        ingest(files);
    });
}

/**
 * Initialize event listeners for character media management.
 */
export function initCharacterMedia() {
    eventSource.on(event_types.CHARACTER_EDITOR_OPENED, () => {
        renderCharacterRefImages();
    });

    // The "+" Create button enters create mode via select_rm_create() without
    // firing CHARACTER_EDITOR_OPENED, so wire the same setup here.
    $(document).on('click', '#rm_button_create', () => {
        renderCharacterRefImages();
    });

    setupRefImagesDropTarget();
}
