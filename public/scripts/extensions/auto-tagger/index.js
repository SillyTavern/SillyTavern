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
    return topics.filter(topic => topic !== "ROOT" && topic !== "TAVERN");
}

function addTagsToChar(character, tagsToAdd) {
    for (let add of tagsToAdd) {

        let tagName = ui.item.value;
        let tag = tags.find(t => t.name === tagName);

        // create new tag if it doesn't exist
        if (!tag) {
            tag = createNewTag(tagName);
        }

        // add tag to the UI and internal map
        appendTagToList(listSelector, tag, { removable: true });
        appendTagToList(getInlineListSelector(), tag, { removable: false });
        addTagToMap(tag.id);
    }


    saveSettingsDebounced();
    printTags();

    // need to return false to keep the input clear
    return false;
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
                const isDescriptionMatch = character.data.description.includes(downloadedCharacter.description);
                const isScenarioMatch = character.scenario.includes(downloadedCharacter.definition);
                const isGreetingMatch = character.data.first_mes.includes(downloadedCharacter.greeting);

                console.log(downloadedCharacter.title);
                console.log(character.personality);
                //const isTaglineMatch = character.tagline === downloadedCharacter.tagline;
                ///const isTopicsMatch = JSON.stringify(character.topics.sort()) === JSON.stringify(downloadedCharacter.topics.sort());

                if (isPersonalityMatch || isDescriptionMatch || isScenarioMatch || isGreetingMatch) {
                    console.log(`Character ${character.name} matches.`);

                    let tags = filterTopics(searchedCharacter.topics);
                    console.log(tags);
                    //applyTagsOnCharacterSelect(character, tags);
                    

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
