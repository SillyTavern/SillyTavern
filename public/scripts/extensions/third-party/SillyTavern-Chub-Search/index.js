// An extension that allows you to import characters from CHub.
// TODO: allow multiple characters to be imported at once
import {
    getRequestHeaders,
    processDroppedFiles,
    callPopup
} from "../../../../script.js";
import { delay, debounce } from "../../../utils.js";
import { extension_settings } from "../../../extensions.js";

const extensionName = "SillyTavern-Chub-Search";
const extensionFolderPath = `scripts/extensions/${extensionName}/`;

// Endpoint for API call
const API_ENDPOINT_SEARCH = "https://api.chub.ai/api/characters/search";
const API_ENDPOINT_DOWNLOAD = "https://api.chub.ai/api/characters/download";

const defaultSettings = {
    findCount: 10,
    nsfw: false,
};

let chubCharacters = [];
let characterListContainer = null;  // A global variable to hold the reference
let popupState = null;
let savedPopupContent = null;


/**
 * Asynchronously loads settings from `extension_settings.chub`, 
 * filling in with default settings if some are missing.
 * 
 * After loading the settings, it also updates the UI components 
 * with the appropriate values from the loaded settings.
 */
async function loadSettings() {
    // Ensure extension_settings.timeline exists
    if (!extension_settings.chub) {
        console.log("Creating extension_settings.chub");
        extension_settings.chub = {};
    }

    // Check and merge each default setting if it doesn't exist
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (!extension_settings.chub.hasOwnProperty(key)) {
            console.log(`Setting default for: ${key}`);
            extension_settings.chub[key] = value;
        }
    }

}

/**
 * Downloads a custom character based on the provided URL.
 * @param {string} input - A string containing the URL of the character to be downloaded.
 * @returns {Promise<void>} - Resolves once the character has been processed or if an error occurs.
 */
async function downloadCharacter(input) {
    const url = input.trim();
    console.debug('Custom content import started', url);
    let request = null;
    // try /api/content/import first and then /import_custom
    request = await fetch('/api/content/import', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ url }),
    });
    if (!request.ok) {  
        request = await fetch('/import_custom', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ url }),
        });
    }

    if (!request.ok) {
        toastr.info("Click to go to the character page", 'Custom content import failed', {onclick: () => window.open(`https://www.chub.ai/characters/${url}`, '_blank') });
        console.error('Custom content import failed', request.status, request.statusText);
        return;
    }

    const data = await request.blob();
    const customContentType = request.headers.get('X-Custom-Content-Type');
    const fileName = request.headers.get('Content-Disposition').split('filename=')[1].replace(/"/g, '');
    const file = new File([data], fileName, { type: data.type });

    switch (customContentType) {
        case 'character':
            processDroppedFiles([file]);
            break;
        default:
            toastr.warning('Unknown content type');
            console.error('Unknown content type', customContentType);
            break;
    }
}

/**
 * Updates the character list in the view based on provided characters.
 * @param {Array} characters - A list of character data objects to be rendered in the view.
 */
function updateCharacterListInView(characters) {
    if (characterListContainer) {
        characterListContainer.innerHTML = characters.map(generateCharacterListItem).join('');
    }
}

/**
 * Generates a list of permutations for the given tags. The permutations include:
 * - Original tag.
 * - Tag in uppercase.
 * - Tag with the first letter in uppercase.
 * @param {Array<string>} tags - List of tags for which permutations are to be generated.
 * @returns {Array<string>} - A list containing all the tag permutations.
 */
function makeTagPermutations(tags) {
    let permutations = [];
    for (let tag of tags) {
        if(tag) {
            permutations.push(tag);
            permutations.push(tag.toUpperCase());
            permutations.push(tag[0].toUpperCase() + tag.slice(1));
        }
    }
    return permutations;
}

/**
 * Fetches characters based on specified search criteria.
 * @param {Object} options - The search options object.
 * @param {string} [options.searchTerm] - A search term to filter characters by name/description.
 * @param {Array<string>} [options.includeTags] - A list of tags that the returned characters should include.
 * @param {Array<string>} [options.excludeTags] - A list of tags that the returned characters should not include.
 * @param {boolean} [options.nsfw] - Whether or not to include NSFW characters. Defaults to the extension settings.
 * @param {string} [options.sort] - The criteria by which to sort the characters. Default is by download count.
 * @param {number} [options.page=1] - The page number for pagination. Defaults to 1.
 * @returns {Promise<Array>} - Resolves with an array of character objects that match the search criteria.
 */
async function fetchCharactersBySearch({ searchTerm, includeTags, excludeTags, nsfw, sort, page=1 }) {

    let first = extension_settings.chub.findCount;
    let asc = false;
    let include_forks = true;
    nsfw = nsfw || extension_settings.chub.nsfw;  // Default to extension settings if not provided
    let require_images = false;
    let require_custom_prompt = false;
    searchTerm = searchTerm ? `search=${encodeURIComponent(searchTerm)}&` : '';
    sort = sort || 'download_count';

    // Construct the URL with the search parameters, if any
    // 
    let url = `${API_ENDPOINT_SEARCH}?${searchTerm}first=${first}&page=${page}&sort=${sort}&asc=${asc}&venus=true&include_forks=${include_forks}&nsfw=${nsfw}&require_images=${require_images}&require_custom_prompt=${require_custom_prompt}`;

    //truncate include and exclude tags to 100 characters
    includeTags = includeTags.filter(tag => tag.length > 0);
    if (includeTags && includeTags.length > 0) {
        //includeTags = makeTagPermutations(includeTags);
        includeTags = includeTags.join(',').slice(0, 100);
        url += `&tags=${encodeURIComponent(includeTags)}`;
    }
    //remove tags that contain no characters
    excludeTags = excludeTags.filter(tag => tag.length > 0);
    if (excludeTags && excludeTags.length > 0) {
        //excludeTags = makeTagPermutations(excludeTags);
        excludeTags = excludeTags.join(',').slice(0, 100);
        url += `&exclude_tags=${encodeURIComponent(excludeTags)}`;
    }

    let searchResponse = await fetch(url);

    let searchData = await searchResponse.json();

    // Clear previous search results
    chubCharacters = [];

    if (searchData.nodes.length === 0) {
        return chubCharacters;
    }
    let charactersPromises = searchData.nodes.map(node => getCharacter(node.fullPath));
    let characterBlobs = await Promise.all(charactersPromises);

    characterBlobs.forEach((character, i) => {
        let imageUrl = URL.createObjectURL(character);
        chubCharacters.push({
            url: imageUrl,
            description: searchData.nodes[i].tagline || "Description here...",
            name: searchData.nodes[i].name,
            fullPath: searchData.nodes[i].fullPath,
            tags: searchData.nodes[i].topics,
            author: searchData.nodes[i].fullPath.split('/')[0],
        });
    });

    return chubCharacters;
}

/**
 * Searches for characters based on the provided options and manages the UI during the search.
 * @param {Object} options - The search criteria/options for fetching characters.
 * @returns {Promise<Array>} - Resolves with an array of character objects that match the search criteria.
 */
async function searchCharacters(options) {
    if (characterListContainer && !document.body.contains(characterListContainer)) {
        console.log('Character list container is not in the DOM, removing reference');
        characterListContainer = null;
    }
    // grey out the character-list-popup while we're searching
    if (characterListContainer) {
        characterListContainer.classList.add('searching');
    }
    console.log('Searching for characters', options);
    const characters = await fetchCharactersBySearch(options);
    if (characterListContainer) {
        characterListContainer.classList.remove('searching');
    }

    return characters;
}

/**
 * Opens the character search popup UI.
 */
function openSearchPopup() {
    displayCharactersInListViewPopup();
}

/**
 * Executes a character search based on provided options and updates the view with the results.
 * @param {Object} options - The search criteria/options for fetching characters.
 * @returns {Promise<void>} - Resolves once the character list has been updated in the view.
 */
async function executeCharacterSearch(options) {
    let characters  = []
    characters = await searchCharacters(options);

    if (characters && characters.length > 0) {
        console.log('Updating character list');
        updateCharacterListInView(characters);
    } else {
        console.log('No characters found');
        characterListContainer.innerHTML = '<div class="no-characters-found">No characters found</div>';
    }
}


/**
 * Generates the HTML structure for a character list item.
 * @param {Object} character - The character data object with properties like url, name, description, tags, and author.
 * @param {number} index - The index of the character in the list.
 * @returns {string} - Returns an HTML string representation of the character list item.
 */
function generateCharacterListItem(character, index) {
    return `
        <div class="character-list-item" data-index="${index}">
            <img class="thumbnail" src="${character.url}">
            <div class="info">
                
                <a href="https://chub.ai/characters/${character.fullPath}" target="_blank"><div class="name">${character.name || "Default Name"}</a>
                <a href="https://chub.ai/users/${character.author}" target="_blank">
                 <span class="author">by ${character.author}</span>
                </a></div>
                <div class="description">${character.description}</div>
                <div class="tags">${character.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
            </div>
            <div data-path="${character.fullPath}" class="menu_button download-btn fa-solid fa-cloud-arrow-down faSmallFontSquareFix"></div>
        </div>
    `;
}


/**
 * Displays a popup for character listings based on certain criteria. The popup provides a UI for 
 * character search, and presents the characters in a list view. Users can search characters by 
 * inputting search terms, including/excluding certain tags, sorting by various options, and opting 
 * for NSFW content. The function also offers image enlargement on click and handles character downloads.
 * 
 * If the popup content was previously generated and saved, it reuses that content. Otherwise, it creates 
 * a new layout using the given state or a default layout structure. 
 * 
 * This function manages multiple event listeners for user interactions such as searching, navigating 
 * between pages, and viewing larger character images.
 * 
 * @async
 * @function
 * @returns {Promise<void>} - Resolves when the popup is displayed and fully initialized.
 */
async function displayCharactersInListViewPopup() {
    if (savedPopupContent) {
        console.log('Using saved popup content');
        // Append the saved content to the popup container
        callPopup('', "text", '', { okButton: "Close", wide: true, large: true })
        .then(() => {
            savedPopupContent = document.querySelector('.list-and-search-wrapper');
        });

        document.getElementById('dialogue_popup_text').appendChild(savedPopupContent);
        characterListContainer = document.querySelector('.character-list-popup');
        return;
    }

    const readableOptions = {
        "download_count": "Download Count",
        "id": "ID",
        "rating": "Rating",
        "default": "Default",
        "rating_count": "Rating Count",
        "last_activity_at": "Last Activity",
        "trending_downloads": "Trending Downloads",
        "created_at": "Creation Date",
        "name": "Name",
        "n_tokens": "Token Count",
        "random": "Random"
    };

    // TODO: This should be a template
    const listLayout = popupState ? popupState : `
    <div class="list-and-search-wrapper" id="list-and-search-wrapper">
        <div class="character-list-popup">
            ${chubCharacters.map((character, index) => generateCharacterListItem(character, index)).join('')}
        </div>
        <hr>
        <div class="search-container">
            <div class="flex-container flex-no-wrap flex-align-center">
            <label for="characterSearchInput"><i class="fas fa-search"></i></label>
            <input type="text" id="characterSearchInput" class="text_pole flex1" placeholder="Search CHUB for characters...">
            </div>
            <div class="flex-container flex-no-wrap flex-align-center">
            <label for="includeTags"><i class="fas fa-plus-square"></i></label>
            <input type="text" id="includeTags" class="text_pole flex1" placeholder="Include tags (comma separated)">
            </div>
            <div class="flex-container">
            <label for="excludeTags"><i class="fas fa-minus-square"></i></label>
            <input type="text" id="excludeTags" class="text_pole flex1" placeholder="Exclude tags (comma separated)">
            </div>
            <div class="page-buttons flex-container flex-no-wrap flex-align-center">
                <div class="flex-container flex-no-wrap flex-align-center">
                    <button class="menu_button" id="pageDownButton"><i class="fas fa-chevron-left"></i></button>
                    <label for="pageNumber">Page:</label>
                    <input type="number" id="pageNumber" class="text_pole textarea_compact wide10pMinFit" min="1" value="1">
                    <button class="menu_button" id="pageUpButton"><i class="fas fa-chevron-right"></i></button>
                </div>
                <div class="flex-container flex-no-wrap flex-align-center">
                <label for="sortOrder">Sort By:</label> <!-- This is the label for sorting -->
                <select class="margin0" id="sortOrder">
                ${Object.keys(readableOptions).map(key => `<option value="${key}">${readableOptions[key]}</option>`).join('')}
                </select>
                </div>
                <div class="flex-container flex-no-wrap flex-align-center">
                    <label for="nsfwCheckbox">NSFW:</label>
                    <input type="checkbox" id="nsfwCheckbox">
                </div>
                <div class="menu_button" id="characterSearchButton">Search</div>
            </div>


        </div>
    </div>
`;

    // Call the popup with our list layout
    callPopup(listLayout, "text", '', { okButton: "Close", wide: true, large: true })
        .then(() => {
            savedPopupContent = document.querySelector('.list-and-search-wrapper');
        });

    characterListContainer = document.querySelector('.character-list-popup');   

    let clone = null;  // Store reference to the cloned image

    characterListContainer.addEventListener('click', function (event) {
        if (event.target.tagName === 'IMG') {
            const image = event.target;

            if (clone) {  // If clone exists, remove it
                document.body.removeChild(clone);
                clone = null;
                return;  // Exit the function
            }

            const rect = image.getBoundingClientRect();

            clone = image.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.top = `${rect.top + window.scrollY}px`;
            clone.style.left = `${rect.left + window.scrollX}px`;
            clone.style.transform = 'scale(4)';  // Enlarge by 4 times
            clone.style.zIndex = 99999;  // High value to ensure it's above other elements
            clone.style.objectFit = 'contain';

            document.body.appendChild(clone);

            // Prevent this click event from reaching the document's click listener
            event.stopPropagation();
        }
    });

    // Add event listener to remove the clone on next click anywhere
    document.addEventListener('click', function handler() {
        if (clone) {
            document.body.removeChild(clone);
            clone = null;
        }
    });


    characterListContainer.addEventListener('click', async function (event) {
        if (event.target.classList.contains('download-btn')) {
            downloadCharacter(event.target.getAttribute('data-path'));
        }
    });

    const executeCharacterSearchDebounced = debounce((options) => executeCharacterSearch(options), 750);

    // Combine the 'keydown' and 'click' event listeners for search functionality, debounce the inputs
    const handleSearch = async function (e) {
        console.log('handleSearch', e);
        if (e.type === 'keydown' && e.key !== 'Enter' && e.target.id !== 'includeTags' && e.target.id !== 'excludeTags') {
            return;
        }

        const splitAndTrim = (str) => {
            str = str.trim(); // Trim the entire string first
            if (!str.includes(',')) {
                return [str];
            }
            return str.split(',').map(tag => tag.trim());
        };

        console.log(document.getElementById('includeTags').value);

        const searchTerm = document.getElementById('characterSearchInput').value;
        const includeTags = splitAndTrim(document.getElementById('includeTags').value);
        const excludeTags = splitAndTrim(document.getElementById('excludeTags').value);
        const nsfw = document.getElementById('nsfwCheckbox').checked;
        const sort = document.getElementById('sortOrder').value;
        let page = document.getElementById('pageNumber').value;

        // If the page number is not being changed, use page 1
        if (e.target.id !== 'pageNumber' && e.target.id !== 'pageUpButton' && e.target.id !== 'pageDownButton') {
            page = 1;
            // set page box to 1
            document.getElementById('pageNumber').value = 1;
        }

        executeCharacterSearchDebounced({
            searchTerm,
            includeTags,
            excludeTags,
            nsfw,
            sort,
            page
        });
    };

    // debounce the inputs
    document.getElementById('characterSearchInput').addEventListener('change', handleSearch);
    document.getElementById('characterSearchButton').addEventListener('click', handleSearch);
    document.getElementById('includeTags').addEventListener('keyup', handleSearch);
    document.getElementById('excludeTags').addEventListener('keyup', handleSearch);
    document.getElementById('sortOrder').addEventListener('change', handleSearch);
    document.getElementById('nsfwCheckbox').addEventListener('change', handleSearch);

    // when the page number is finished being changed, search again
    document.getElementById('pageNumber').addEventListener('change', handleSearch);
    // on page up or down, update the page number, don't go below 1
    document.getElementById('pageUpButton').addEventListener('click', function (e) {
        let pageNumber = document.getElementById('pageNumber'); 

        pageNumber.value = parseInt(pageNumber.value) + 1;
        pageNumber.value = Math.max(1, pageNumber.value);
        handleSearch(e);
    }
    );
    document.getElementById('pageDownButton').addEventListener('click', function (e) {
        let pageNumber = document.getElementById('pageNumber');
        pageNumber.value = parseInt(pageNumber.value) - 1;
        pageNumber.value = Math.max(1, pageNumber.value);
        handleSearch(e);
    }
    );
}

/**
 * Fetches a character by making an API call.
 * 
 * This function sends a POST request to the API_ENDPOINT_DOWNLOAD with a provided character's fullPath. 
 * It requests the character in the "tavern" format and the "main" version. Once the data is fetched, it 
 * is converted to a blob before being returned.
 * 
 * @async
 * @function
 * @param {string} fullPath - The unique path/reference for the character to be fetched.
 * @returns {Promise<Blob>} - Resolves with a Blob of the fetched character data.
 */
async function getCharacter(fullPath) {
    let response = await fetch(
        API_ENDPOINT_DOWNLOAD,
        {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fullPath: fullPath,
                format: "tavern",
                version: "main"
            }),
        }
    );

    // If the request failed, try a backup endpoint - https://avatars.charhub.io/{fullPath}/avatar.webp
    if (!response.ok) {
        console.log(`Request failed for ${fullPath}, trying backup endpoint`);
        response = await fetch(
            `https://avatars.charhub.io/avatars/${fullPath}/avatar.webp`,
            {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json'
                },
            }
        );
    }
    let data = await response.blob();
    return data;
}

/**
 * jQuery document-ready block:
 * - Fetches the HTML settings for an extension from a known endpoint and prepares a button for character search.
 * - The button, when clicked, triggers the `openSearchPopup` function.
 * - Finally, it loads any previously saved settings related to this extension.
 */
jQuery(async () => {
    // put our button in between external_import_button and rm_button_group_chats in the form_character_search_form
    // on hover, should say "Search CHub for characters"
    $("#external_import_button").after('<button id="search-chub" class="menu_button fa-solid fa-cloud-bolt faSmallFontSquareFix" title="Search CHub for characters"></button>');
    $("#search-chub").on("click", function () {
        openSearchPopup();
    });

    loadSettings();
});
