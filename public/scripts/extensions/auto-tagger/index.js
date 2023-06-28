import { getContext } from "../../extensions.js";
import { applyTagsOnCharacterSelect } from "../../tags.js";

// Endpoint for API call
const API_ENDPOINT_SEARCH = "https://api.chub.ai/api/characters/search";
const API_ENDPOINT_DOWNLOAD = "https://api.chub.ai/api/characters/download";

// Function to fetch character data
async function fetchCharacterData(name) {
    const response = await fetch(`${API_ENDPOINT_SEARCH}?search=${encodeURIComponent(name)}`);
    const data = await response.json();
    return data.nodes.find(node => node.name === name);
}

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


// Function to filter out topics like "ROOT" and "Tavern"
function filterTopics(topics) {
    return topics.filter(topic => topic !== "ROOT" && topic !== "Tavern");
}

// Function to execute on button click
async function onButtonClick() {
    console.log("Comparing characters...")
    const characters = getContext().characters;
    try {
        for (let character of characters) {
            const searchedCharacter = await fetchCharacterData(character.name);
            if (searchedCharacter) {
                const downloadedCharacter = await downloadCharacter(searchedCharacter.fullPath);

                //Check if character.data.description and character.scenerio are in downloadedCharacter.description
                const downloadDesc = downloadedCharacter.description.replace("\"", "");
                const isPersonalityMatch = character.personality.includes(downloadedCharacter.title);
                console.log(downloadedCharacter.title);
                console.log(character.personality);
                //const isTaglineMatch = character.tagline === downloadedCharacter.tagline;
                ///const isTopicsMatch = JSON.stringify(character.topics.sort()) === JSON.stringify(downloadedCharacter.topics.sort());

                if (isPersonalityMatch) {
                    console.log(`Character ${character.name} matches.`);
                    let tags = filterTopics(searchedCharacter.topics);
                    applyTagsOnCharacterSelect(character, tags);

                } else {
                    console.log(`Character ${character.name} does not match.`);
                    if (!isPersonalityMatch) {
                        console.log(`- Personality does not match. Generated: ${character.data.description}, API: ${downloadedCharacter.description}`);
                        console.log(character);
                        console.log(downloadedCharacter);
                        console.log(searchedCharacter);
                    }
                    // if (!isTaglineMatch) {
                    //     console.log(`- Tagline does not match. Generated: ${character.tagline}, API: ${downloadedCharacter.tagline}`);
                    // }
                    // if (!isTopicsMatch) {
                    //     console.log(`- Topics do not match. Generated: ${character.topics.join(", ")}, API: ${downloadedCharacter.topics.join(", ")}`);
                    // }
                }
            } else {
                console.log(`Character ${character.name} not found.`);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

jQuery(() => {
    const settingsHtml = `
    <div class="auto-tagger-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
            <b>auto-tagger</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">


            <div class="auto-tagger_block flex-container">
                <input id="compare-characters" class="menu_button" type="submit" value="Compare Characters" /> <!-- New button for comparison -->
            </div>



            <!-- New div for comparison results -->
            <div id="comparison-results"></div>

            <hr class="sysHR">
        </div>
    </div>`;

    // Append settingsHtml to extensions_settings
    $('#extensions_settings').append(settingsHtml);
    $('#compare-characters').on('click', onButtonClick);
});
