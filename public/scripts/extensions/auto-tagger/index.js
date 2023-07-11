import {
    saveSettingsDebounced,
    getSettings,
    getRequestHeaders,
    getCharacters,
    select_selected_character,
} from "../../../script.js";
import { extension_settings, getContext } from "../../extensions.js";
import { importTags } from "../../tags.js";

// Endpoint for API call
const API_ENDPOINT_SEARCH = "https://api.chub.ai/api/characters/search";
const API_ENDPOINT_DOWNLOAD = "https://api.chub.ai/api/characters/download";

const defaultSettings = {
    useAltDescription: false,
    getCreatorsNote: false,
};

/**
 * Generates and returns a Set of bigrams (pairs of consecutive characters) from a given string.
 * @param {string} str - The string to generate bigrams from.
 * @returns {Set} - A Set object containing all unique bigrams in the string.
 */
function getBigrams(str) {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i += 1) {
        bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
}

/**
 * Returns a new Set that contains only the elements present in both input Sets.
 * @param {Set} set1 - The first Set.
 * @param {Set} set2 - The second Set.
 * @returns {Set} - A Set containing elements that are common in both input Sets.
 */
function intersect(set1, set2) {
    return new Set([...set1].filter((x) => set2.has(x)));
}

/**
 * Calculates and returns the Dice's coefficient for two strings.
 * Dice's coefficient is a measure of the sets' overlap where 0 means no overlap and 1 means total overlap.
 * @param {string} str1 - The first string to compare.
 * @param {string} str2 - The second string to compare.
 * @returns {number} - Dice's coefficient for the two input strings.
 */
function diceCoefficient(str1, str2) {
    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);
    return (
        (2 * intersect(bigrams1, bigrams2).size) /
        (bigrams1.size + bigrams2.size)
    );
}

/**
 * Loads the settings for the tag importer extension.
 * If the settings haven't been initialized yet, they are set to default.
 * Then, the settings are used to set the properties of HTML elements with ids 'use_alt_desc' and 'get_creators_notes'.
 */
function loadSettings() {
    if (Object.keys(extension_settings.tag_importer).length === 0) {
        Object.assign(extension_settings.tag_importer, defaultSettings);
    }
    $("#use_alt_desc")
        .prop("checked", extension_settings.tag_importer.useAltDescription)
        .trigger("input");
    $("#get_creators_notes")
        .prop("checked", extension_settings.tag_importer.getCreatorsNote)
        .trigger("input");
}

/**
 * Updates the 'useAltDescription' setting in the extension settings based on the checkbox's state.
 * This function is designed to be used as an event handler for an input event on a checkbox.
 * After the setting is updated, the settings are saved (debounced).
 */
function onAltDescriptionInput() {
    const value = Boolean($(this).prop("checked"));
    extension_settings.tag_importer.useAltDescription = value;
    saveSettingsDebounced();
}

/**
 * Updates the 'getCreatorsNote' setting in the extension settings based on the checkbox's state.
 * This function is designed to be used as an event handler for an input event on a checkbox.
 * After the setting is updated, the settings are saved (debounced).
 */
function onGetCreatorsNotesInput() {
    const value = Boolean($(this).prop("checked"));
    extension_settings.tag_importer.getCreatorsNote = value;
    saveSettingsDebounced();
}

/**
 * Fetch character data from the API based on name and description.
 *
 * This function sends two separate requests to the API to search for character data based on name and description.
 * The function expects a name and description string as input, and returns a Promise that resolves to an array
 * of character data objects. The function searches for both the name and the first 40 characters of the description.
 * If both searches return results, the function combines the results into a single array. If only one search returns
 * results, the function returns the results from that search. If neither search returns results, the function returns
 * an empty array.
 *
 * @param {string} name - The name of the character to search for.
 * @param {string} description - The description of the character to search for.
 * @returns {Promise<Object[]>} - A Promise that resolves to an array of character data objects.
 */
async function fetchCharacterData(name, description) {
    let name_response = await fetch(
        `${API_ENDPOINT_SEARCH}?search=${encodeURIComponent(
            name
        )}&first=10&nsfw=true`
    );
    let name_data = await name_response.json();

    // now search for the first 40 characters of the description
    description = description.substring(0, 40);
    let char_response = await fetch(
        `${API_ENDPOINT_SEARCH}?search=${encodeURIComponent(
            description
        )}&first=10&nsfw=true`
    );
    let char_data = await char_response.json();

    let data = [];

    if (name_data.nodes?.length > 0 && char_data.nodes?.length > 0) {
        data = [...name_data.nodes, ...char_data.nodes];
    } else if (name_data.nodes?.length > 0) {
        data = name_data.nodes;
    } else if (char_data.nodes?.length > 0) {
        data = char_data.nodes;
    }
    return data;
}

/**
 * Download a character file from the server.
 *
 * This function sends a POST request to the server to download a character file in the specified format.
 * The function expects a full path to the character file, which is used to identify the file on the server.
 * The function returns a Promise that resolves to the downloaded character data.
 *
 * @param {string} fullPath - The full path to the character file on the server.
 * @returns {Promise<Object>} - A Promise that resolves to the downloaded character data.
 */
async function downloadCharacter(fullPath) {
    const response = await fetch(API_ENDPOINT_DOWNLOAD, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            format: "cai",
            fullPath: fullPath,
            version: "main",
        }),
    });
    const data = await response.json();
    return data;
}

/**
 * Add tags to a character and update the UI and internal map.
 *
 * This function takes a character object and an array of tag names to add to the character.
 * If a tag with the specified name does not exist, a new tag is created. The function then
 * adds the tag to the UI and internal map, and saves the updated settings. Finally, the function
 * prints the updated tags to the console.
 *
 * @param {Object} character - The character object to add tags to.
 * @param {string[]} tagsToAdd - An array of tag names to add to the character.
 * @returns {boolean} - Returns false to keep the input clear.
 */ function filterTopics(topics) {
    return topics.filter((topic) => topic !== "ROOT" && topic !== "TAVERN");
}

/**
 * Fetches and processes character data when the button is clicked.
 * This function also logs any errors that occur during the execution.
 * A notification is displayed to indicate the processing status, and after the processing is completed, the characters' settings and data are fetched again.
 */
async function onCImportButtonClick() {
    console.debug("Comparing characters...");
    toastr.info(
        "This may take some time, depending on the number of cards",
        "Processing..."
    );
    const characters = getContext().characters;
    let importCreatorInfo = extension_settings.tag_importer.getCreatorsNote;
    let useAltDescription = extension_settings.tag_importer.useAltDescription;

    try {
        for (let character of characters) {
            const searchedCharacters = await fetchCharacterData(
                character.name,
                character.description
            );
            let found = false;
            for (let searchedCharacterKey in searchedCharacters) {
                let searchedCharacter =
                    searchedCharacters[searchedCharacterKey];
                found = await processCharacter(
                    searchedCharacter,
                    character,
                    importCreatorInfo,
                    useAltDescription
                );
                if (found) {
                    break;
                }
            }
            if (!found) {
                toastr.warning(`No match found for ${character.name}`);
            }
        }
        await getSettings();
        await getCharacters();
    } catch (error) {
        toastr.error("Something went wrong while importing from CHub");
        console.error(
            `An error occurred while processing characters: ${error}`
        );
    }
    toastr.success(`Import complete`, `All characters processed`);
}

/**
 * Processes a single character, comparing various attributes and potentially importing data.
 * @param {Object} searchedCharacter - The character found in the search.
 * @param {Object} character - The original character to compare with.
 * @param {boolean} importCreatorInfo - Flag indicating whether creator info should be imported.
 * @param {boolean} useAltDescription - Flag indicating whether to use an alternate description.
 * @returns {boolean} - A boolean indicating if the character data import was successful.
 */
async function processCharacter(
    searchedCharacter,
    character,
    importCreatorInfo,
    useAltDescription
) {
    const downloadedCharacter = await downloadCharacter(
        searchedCharacter.fullPath
    );
    const author = getAuthorFromPath(searchedCharacter.fullPath);

    const isAuthorMatch = character.creator?.includes(author);
    const isPersonalityMatch = isMatch(
        character.personality,
        downloadedCharacter.title
    );
    const isDescriptionMatch = isMatch(
        character.description,
        downloadedCharacter.description
    );
    const isScenarioMatch = isMatch(
        character.mes_example.replace(/(\r\n|\n|\r)/gm, ""),
        downloadedCharacter.definition.replace(/(\r\n|\n|\r)/gm, "")
    );
    const isGreetingMatch = isMatch(
        character.first_mes,
        downloadedCharacter.greeting
    );

    if (
        checkMatch([
            isPersonalityMatch,
            isDescriptionMatch,
            isScenarioMatch,
            isGreetingMatch,
            isAuthorMatch,
        ])
    ) {
        await importData(
            character,
            searchedCharacter,
            importCreatorInfo,
            author,
            useAltDescription
                ? searchedCharacter.tagline
                : downloadedCharacter.description
        );
        return true;
    } else {
        console.debug(`Character ${character.name} does not match.`);
    }
    return false;
}

/**
 * Compares two strings using the Dice Coefficient.
 * @param {string} a - First string to compare.
 * @param {string} b - Second string to compare.
 * @return {boolean} True if the coefficient is greater than 0.8, false otherwise.
 */
function isMatch(a, b) {
    return diceCoefficient(a, b) > 0.8;
}

/**
 * Checks if the number of true values in an array exceeds a threshold.
 * @param {Array.<boolean>} matches - An array of boolean values.
 * @return {boolean} True if there are 2 or more true values in the array, false otherwise.
 */
function checkMatch(matches) {
    return matches.filter((value) => value === true).length >= 2;
}

/**
 * Imports data for a single character, including tags and potentially creator info.
 * @param {Object} character - The original character to update.
 * @param {Object} searchedCharacter - The character found in the search.
 * @param {boolean} importCreatorInfo - Flag indicating whether creator info should be imported.
 * @param {string} author - The author of the searched character.
 * @param {string} description - The description of the downloaded character.
 */
async function importData(
    character,
    searchedCharacter,
    importCreatorInfo,
    author,
    description
) {
    let tags = filterTopics(searchedCharacter.topics);
    character.tags = addTags(character.tags, tags);
    console.debug(`Importing ${tags.length} tags for ${character.name}.`);
    await importTags(character);

    if (importCreatorInfo) {
        console.debug(`Importing creator info for ${character.name}.`);
        await editCharacterAttribute(
            author,
            "creator",
            character.avatar,
            character.name
        );
        await editCharacterAttribute(
            description,
            "creator_notes",
            character.avatar,
            character.name
        );
        await getCharacters();
        $("#creator_textarea").val(character.data?.creator);
        $("#creator_notes_textarea").val(character.data?.creator_notes || character.creatorcomment);
    }
    toastr.success(
        `${importCreatorInfo ? "Creator info and " : ""}${
            tags.length
        } tags imported`,
        `Import for ${character.name} complete`
    );
}

/**
 * Adds new tags to an array of existing tags, avoiding duplicates.
 * @param {Array.<string>} characterTags - The existing tags.
 * @param {Array.<string>} newTags - The new tags to add.
 * @return {Array.<string>} The updated array of tags.
 */
function addTags(characterTags, newTags) {
    if (!characterTags) {
        characterTags = [];
    }

    for (let tag of newTags) {
        if (!characterTags.includes(tag)) {
            characterTags.push(tag);
            console.log(`Adding tag ${tag}.`);
        }
    }

    return characterTags;
}

/**
 * Sends a POST request to the "/editcharacterattribute" endpoint to edit a specific character attribute.
 * @param {string} value - The new value for the attribute.
 * @param {string} field - The name of the attribute to edit.
 * @param {string} avatar_url - The URL of the character's avatar.
 * @param {string} ch_name - The name of the character.
 */
async function editCharacterAttribute(value, field, avatar_url, ch_name) {
    if (value) {
        const headers = getRequestHeaders();
        const response = await fetch("/editcharacterattribute", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                field: field,
                value: value,
                avatar_url: avatar_url,
                ch_name: ch_name,
            }),
        });
        if (response.ok) {
            console.log(`Imported ${field} for ${ch_name}.`);
        }
    }
}

/**
 * Extracts the author's name from a file path.
 * @param {string} fullPath - The full path of the file.
 * @return {string} The author's name.
 */
function getAuthorFromPath(fullPath) {
    return fullPath.split("/")[0];
}

jQuery(async () => {
    const settingsHtml = await $.get(
        "scripts/extensions/auto-tagger/dropdown.html"
    );
    // Append settingsHtml to extensions_settings
    $("#extensions_settings2").append(settingsHtml);
    $("#chub-import").on("click", onCImportButtonClick);
    $("#use_alt_desc").on("input", onAltDescriptionInput);
    $("#get_creators_notes").on("input", onGetCreatorsNotesInput);
    loadSettings();
});
