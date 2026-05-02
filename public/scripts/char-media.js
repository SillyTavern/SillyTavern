/**
 * Handles inline media (reference images, video, audio) for character cards.
 * These attachments are stored in character data extensions and can be sent
 * to multimodal models as additional context alongside character descriptions.
 */

import { characters, this_chid } from '../script.js';
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
 * Gets the inline media array for the current character.
 * @returns {CharacterMediaAttachment[]}
 */
export function getCharacterInlineMedia() {
    const character = characters[this_chid];
    if (!character?.data?.extensions?.[EXTENSION_KEY]) {
        return [];
    }
    return character.data.extensions[EXTENSION_KEY];
}

/**
 * Gets the per-character body of the reference-media user message.
 * Empty string when unset, which means the message is sent with no body
 * (just attachments).
 * @returns {string}
 */
export function getCharacterInlineMediaPrompt() {
    const character = characters[this_chid];
    const value = character?.data?.extensions?.[PROMPT_KEY];
    return typeof value === 'string' ? value : '';
}

/**
 * Persists the per-character override for the reference-media message body.
 * @param {string} value
 */
export async function setCharacterInlineMediaPrompt(value) {
    if (this_chid === undefined) return;
    await writeExtensionField(this_chid, PROMPT_KEY, value || '');
}

/**
 * Uploads a media file (image / video / audio) and attaches it to the current character.
 * @param {File} file - The media file to upload
 * @returns {Promise<CharacterMediaAttachment|null>} The created attachment, or null on failure
 */
export async function attachMediaToCharacter(file) {
    if (this_chid === undefined) {
        toastr.warning(t`No character selected.`);
        return null;
    }

    const character = characters[this_chid];
    if (!character) {
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
        const charName = character.name || 'unknown';

        const url = await saveBase64AsFile(base64Data, charName, fileName, extension);

        /** @type {CharacterMediaAttachment} */
        const attachment = {
            url,
            name: file.name,
            type: mediaType,
            created: Date.now(),
        };

        const media = getCharacterInlineMedia();
        media.push(attachment);
        await writeExtensionField(this_chid, EXTENSION_KEY, media);

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
    await writeExtensionField(this_chid, EXTENSION_KEY, media);

    if (removed?.url) {
        try {
            await deleteMediaFromServer(removed.url, /* silent */ true);
        } catch (error) {
            console.warn('Failed to delete inline_media asset from disk', removed.url, error);
        }
    }
}
