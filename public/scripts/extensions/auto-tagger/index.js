import { saveCharacterDebounced, this_chid, saveSettingsDebounced, getSettings, getRequestHeaders, getCharacters } from "../../../script.js";
import { getContext } from "../../extensions.js";
import { applyTagsOnCharacterSelect, importTags } from "../../tags.js";
import { generateQuietPrompt } from "../../../script.js";


function getBigrams(str) {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i += 1) {
        bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
}

function intersect(set1, set2) {
    return new Set([...set1].filter((x) => set2.has(x)));
}

function diceCoefficient(str1, str2) {
    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);
    return (2 * intersect(bigrams1, bigrams2).size) / (bigrams1.size + bigrams2.size);
}



// Endpoint for API call
const API_ENDPOINT_SEARCH = "https://api.chub.ai/api/characters/search";
const API_ENDPOINT_DOWNLOAD = "https://api.chub.ai/api/characters/download";


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
    let name_response = await fetch(`${API_ENDPOINT_SEARCH}?search=${encodeURIComponent(name)}&first=3&nsfw=true`);
    let name_data = await name_response.json();

    // now search for the first 40 characters of the description
    description = description.substring(0, 40);
    let char_response = await fetch(`${API_ENDPOINT_SEARCH}?search=${encodeURIComponent(description)}&first=3&nsfw=true`);
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
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            format: "cai",
            fullPath: fullPath,
            version: "main"
        })
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
 */function filterTopics(topics) {
    return topics.filter(topic => topic !== "ROOT" && topic !== "TAVERN");
}

// Function to execute on button click
async function onButtonClick() {
    console.log("Comparing characters...")
    const characters = getContext().characters;
    let importCreatorInfo = true;
    try {
        for (let character of characters) {

            const searchedCharacters = await fetchCharacterData(character.name, character.description);
            console.log(searchedCharacters.values());
            for (let searchedCharacterKey in searchedCharacters) {
                let searchedCharacter = searchedCharacters[searchedCharacterKey];
                const downloadedCharacter = await downloadCharacter(searchedCharacter.fullPath);

                let author = searchedCharacter.fullPath.split("/")[0];
                let isAuthorMatch = false;
                //Check if character.data.description and character.scenerio are in downloadedCharacter.description, log each comparison
                const downloadDesc = downloadedCharacter.description.replace("\"", "");

                const isPersonalityMatch = diceCoefficient(character.personality, downloadedCharacter.title) > 0.8;
                const isDescriptionMatch = diceCoefficient(character.description, downloadedCharacter.description) > 0.8;
                //purge newlines and returns from mes_example and definition during comparison
                let temp_mes_example = character.mes_example.replace(/(\r\n|\n|\r)/gm, "");
                let tempDefinition = downloadedCharacter.definition.replace(/(\r\n|\n|\r)/gm, "");
                const isScenarioMatch = diceCoefficient(temp_mes_example, tempDefinition) > 0.8;
                const isGreetingMatch = diceCoefficient(character.first_mes, downloadedCharacter.greeting) > 0.8;

                if (author && character.creator) {
                    isAuthorMatch = character.creator.includes(author);
                }

                if ([isPersonalityMatch, isDescriptionMatch, isScenarioMatch, isGreetingMatch, isAuthorMatch].filter(value => value === true).length >= 2) {

                    //if we matched with 2 cases, add tags, creator, creator notes
                    //add tags
                    let tags = filterTopics(searchedCharacter.topics);
                    //console.log(tags);
                    //add tags list to character if it doesn't exist
                    if (!character.tags) {
                        character.tags = [];
                    }
                    //only add tags if they don't already exist
                    for (let tag of tags) {
                        if (character.tags && !character.tags.includes(tag)) {
                            character.tags.push(tag);
                            console.log(`Adding tag ${tag} to ${character.name}.`);
                        }
                    }

                    console.debug(`Importing ${tags.length} tags for ${character.name}.`);
                    await importTags(character);


                    if (importCreatorInfo) {
                        //add creator
                        let headers = getRequestHeaders();
                        if (author && !character.creator) {
                            // send field, value, avatar_url, ch_name
                            const response = await fetch("/editcharacterattribute", {
                                method: 'POST',
                                headers: headers,
                                body: JSON.stringify({ field: "creator", value: author, avatar_url: character.avatar, ch_name: character.name })
                            });
                            if (response.ok) {
                                console.log(`Imported creator for ${character.name}.`);
                            }
                        }
                        //add creator notes
                        if (downloadedCharacter.description && !character.creator_notes) {
                            //character.creator_notes = searchedCharacter.description;
                            const response = await fetch("/editcharacterattribute", {
                                method: 'POST',
                                headers: headers,
                                body: JSON.stringify({ field: "creator_notes", value: searchedCharacter.description, avatar_url: character.avatar, ch_name: character.name })
                            });
                            if (response.ok) {
                                console.log(`Imported creator notes for ${character.name}.`);
                            }
                        }
                        saveSettingsDebounced();
                    }
                    break;
                } else {
                    console.log(`Character ${character.name} does not match.`);
                }
            }
        }
        await getCharacters();
    } catch (error) {
        console.error(error);
    }
}

jQuery(() => {
    const settingsHtml = `
    <div class="auto-tagger-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
            <b>CHub Tag Importer</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">


            <div class="auto-tagger_block flex-container">
                <input id="compare-characters" class="menu_button" type="submit" value="Compare Characters" /> <!-- New button for comparison -->
            </div>
            <div class="auto-tagger_block flex-container">
                <input id="robo-tag" class="menu_button" type="submit" value="Robo Tag" /> <!-- New button for comparison -->
            </div>



            <!-- New div for comparison results -->
            <div id="comparison-results"></div>

            <hr class="sysHR">
        </div>
    </div>`;

    // Append settingsHtml to extensions_settings
    $('#extensions_settings').append(settingsHtml);
    $('#compare-characters').on('click', onButtonClick);
    $('#robo-tag').on('click', tagCharMain);
});
