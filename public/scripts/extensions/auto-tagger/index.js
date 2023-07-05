import { saveCharacterDebounced, this_chid, saveSettingsDebounced, getSettings, getRequestHeaders } from "../../../script.js";
import { getContext } from "../../extensions.js";
import { applyTagsOnCharacterSelect, importTags } from "../../tags.js";
import { generateQuietPrompt } from "../../../script.js";


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

async function tagCharMain(character) {
    

    //const defaultPrompt = '[Pause your roleplay. Summarize the most important facts and events that have happened in the chat so far. If a summary already exists in your memory, use that as a base and expand with new facts. Limit the summary to {{words}} words or less. Your response should include nothing but the summary.]';

    let prompt = `\n[Using the prior character descriptions, produce a list of 5 tags that describe the character including a content rating(SFW, NSFW, NSFL). Only reply with a comma separated list of tags and nothing else.]`

    let context = getContext();
    console.log(context);
    let currentChar = this_chid;
    let currentCharName = character.name;
    //get description, personality, scenario, from context.characters[currentChar]
    console.log(currentChar, context.characters);
    console.log(context.characters[currentChar]);
    let description = context.characters[currentChar].description;
    let personality = context.characters[currentChar].personality;
    let scenario = context.characters[currentChar].scenario;
    let greeting = context.characters[currentChar].first_mes;

    //build prompt from description, personality, scenario, greeting

    prompt = description + personality + scenario + greeting + prompt;


    const summary = await generateQuietPrompt(prompt, true);
    console.log(summary);
    // const newContext = getContext();

    // // something changed during summarization request
    // if (newContext.groupId !== context.groupId
    //     || newContext.chatId !== context.chatId
    //     || (!newContext.groupId && (newContext.characterId !== context.characterId))) {
    //     console.log('Context changed, summary discarded');
    //     return;
    // }

    // setMemoryContext(summary, true);
    // return summary;
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
    let context = getContext();
    let importCreatorInfo = true;
    console.log(context);
    try {
        for (let character of characters) {
            const searchedCharacter = await fetchCharacterData(character.name);
            if (searchedCharacter) {
                const downloadedCharacter = await downloadCharacter(searchedCharacter.fullPath);
                // console.log(downloadedCharacter);
                // console.log(searchedCharacter);
                // console.log(character);

                let author = searchedCharacter.fullPath.split("/")[0];
                let isAuthorMatch = false;
                //Check if character.data.description and character.scenerio are in downloadedCharacter.description, log each comparison
                const downloadDesc = downloadedCharacter.description.replace("\"", "");
                const isPersonalityMatch = character.personality.includes(downloadedCharacter.title);
                const isDescriptionMatch = character.data.description.includes(downloadedCharacter.description);
                //purge newlines and returns from mes_example and definition during comparison
                let temp_mes_example = character.mes_example.replace(/(\r\n|\n|\r)/gm, "");
                let tempDefinition = downloadedCharacter.definition.replace(/(\r\n|\n|\r)/gm, "");
                const isScenarioMatch = temp_mes_example.includes(tempDefinition);
                const isGreetingMatch = character.data.first_mes.includes(downloadedCharacter.greeting);
                if (author && character.creator){
                    isAuthorMatch = character.creator.includes(author);
                }

                //print if not match
                // if (!isPersonalityMatch) {
                //     console.log(`Personality does not match. ${character.personality} vs ${downloadedCharacter.title}`);
                // }
                // if (!isDescriptionMatch) {
                //     console.log(`Description does not match. ${character.data.description} vs ${downloadedCharacter.description}`);
                // }
                // if (!isScenarioMatch) {
                //     console.log(`Scenario does not match. ${character.scenario} vs ${downloadedCharacter.definition}`);
                // }
                // if (!isGreetingMatch) {
                //     console.log(`Greeting does not match. ${character.data.first_mes} vs ${downloadedCharacter.greeting}`);
                // }
                // if (!isAuthorMatch) {
                //     console.log(`Author does not match. ${character.creator} vs ${author}`);
                // }

                // if any 2 of these are true, add tags, isPersonalityMatch, isDescriptionMatch, isScenarioMatch, isGreetingMatch

                if ([isPersonalityMatch, isDescriptionMatch, isScenarioMatch, isGreetingMatch, isAuthorMatch].filter(value => value === true).length >= 2) {

                    //if we matched with 2 cases, add tags, creator, creator notes
                    //console.log(`Character ${character.name} matches.`);

                    //add tags
                    let tags = filterTopics(searchedCharacter.topics);
                    //console.log(tags);
                    //only add tags if they don't already exist
                    for (let tag of tags) {
                        if (!character.tags.includes(tag)) {
                            character.tags.push(tag);
                            console.log(`Adding tag ${tag} to ${character.name}.`);
                        }
                    }

                    console.log(`Importing ${tags.length} tags for ${character.name}.`);
                    await importTags(character);

                    
                    if(importCreatorInfo){
                        //add creator
                        if (author && !character.creator) {
                            character.creator = author;
                        }
                        //add creator notes
                        if (downloadedCharacter.description && !character.creator_notes) {
                            character.creator_notes = searchedCharacter.description;
                        }
                        let url = '/editcharacter';
                        character.ch_name = character.name;

                        const formData = new FormData();
                        let headers = getRequestHeaders();
                        headers["Content-Type"] = "multipart/form-data" + "; boundary=" + formData._boundary

                        for (let key in character) {
                            formData.append(key, character[key]);
                        }
                        const response = await fetch("/editcharacter", {
                            method: 'POST',
                            headers: headers,
                            body: (formData)
                        });
                        if (response.ok) {
                            await getCharacters();
                            console.log(`Imported creator info for ${character.name}.`);
                        }
                        saveSettingsDebounced();
                    }

                    

                } else {
                    console.log(`Character ${character.name} does not match.`);
                    if (!isPersonalityMatch) {
                        console.log(`- Personality does not match. Generated: ${character.data.description}, API: ${downloadedCharacter.description}`);
                        console.log(character);
                        console.log(downloadedCharacter);
                        console.log(searchedCharacter);
                    }
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
