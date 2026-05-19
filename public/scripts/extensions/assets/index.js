/*
TODO:
*/
//const DEBUG_TONY_SAMA_FORK_MODE = true

import { DOMPurify } from '../../../lib.js';
import { getRequestHeaders, processDroppedFiles, eventSource, event_types } from '../../../script.js';
import { deleteExtension, EMPTY_AUTHOR, extensionNames, getAuthorFromUrl, getContext, installExtension, renderExtensionTemplateAsync, isOfficialExtension } from '../../extensions.js';
import { POPUP_TYPE, Popup, callGenericPopup } from '../../popup.js';
import { accountStorage } from '../../util/AccountStorage.js';
import { escapeHtml, flashHighlight, getStringHash, isValidUrl } from '../../utils.js';
import { t, translate } from '../../i18n.js';
import { SlashCommandParser } from '/scripts/slash-commands/SlashCommandParser.js';
export { MODULE_NAME };

const MODULE_NAME = 'assets';
const DEBUG_PREFIX = '<Assets module> ';
let previewAudio = null;
let ASSETS_JSON_URL = 'https://raw.githubusercontent.com/SillyTavern/SillyTavern-Content/main/index.json';


// DBG
//if (DEBUG_TONY_SAMA_FORK_MODE)
//    ASSETS_JSON_URL = "https://raw.githubusercontent.com/Tony-sama/SillyTavern-Content/main/index.json"
let availableAssets = {};
let currentAssets = {};

//#############################//
//  Extension UI and Settings  //
//#############################//

function filterAssets() {
    const searchValue = String($('#assets_search').val()).toLowerCase().trim();
    const typeValue = String($('#assets_type_select').val());

    if (typeValue === '') {
        $('#assets_menu .assets-list-div').show();
        $('#assets_menu .assets-list-div h3').show();
    } else {
        $('#assets_menu .assets-list-div h3').hide();
        $('#assets_menu .assets-list-div').hide();
        $(`#assets_menu .assets-list-div[data-type="${typeValue}"]`).show();
    }

    if (searchValue === '') {
        $('#assets_menu .asset-block').show();
    } else {
        $('#assets_menu .asset-block').hide();
        $('#assets_menu .asset-block').filter(function () {
            return $(this).text().toLowerCase().includes(searchValue);
        }).show();
    }
}

const KNOWN_TYPES = {
    'extension': t`Extensions`,
    'character': t`Characters`,
    'ambient': t`Ambient sounds`,
    'bgm': t`Background music`,
    'blip': t`Blip sounds`,
};

/**
 * Creates the download/delete button element for a single asset, with all interaction handlers attached.
 * @param {object} asset The asset data object, containing at least id, name, description and url fields
 * @param {string} assetType Asset type, e.g. 'extension', 'character', 'ambient', 'bgm', 'blip'
 * @param {number} index Index of the asset in the list of available assets of the same type, used to create a unique element ID
 * @returns {JQuery} The button element
 */
function createAssetButton(asset, assetType, index) {
    const elemId = `assets_install_${assetType}_${index}`;
    const element = $('<div />', { id: elemId, class: 'asset-download-button right_menu_button' });
    const label = $('<i class="fa-fw fa-solid fa-download fa-lg"></i>');
    element.append(label);

    console.debug(DEBUG_PREFIX, 'Checking asset', asset.id, asset.url);

    const assetInstall = async function () {
        element.off('click');
        label.removeClass('fa-download');
        this.classList.add('asset-download-button-loading');
        const result = await installAsset(asset.url, assetType, asset.id);
        if (!result) {
            this.classList.remove('asset-download-button-loading');
            label.addClass('fa-download');
            label.removeClass('fa-spinner');
            label.removeClass('fa-spin');
            element.on('click', assetInstall);
            return;
        }
        label.addClass('fa-check');
        this.classList.remove('asset-download-button-loading');
        element.on('click', assetDelete);
        element.on('mouseenter', function () {
            label.removeClass('fa-check');
            label.addClass('fa-trash');
            label.addClass('redOverlayGlow');
        }).on('mouseleave', function () {
            label.addClass('fa-check');
            label.removeClass('fa-trash');
            label.removeClass('redOverlayGlow');
        });
    };

    const assetDelete = async function () {
        if (assetType === 'character') {
            toastr.error('Go to the characters menu to delete a character.', 'Character deletion not supported');
            await SlashCommandParser.commands.go.callback(null, asset.id);
            return;
        }
        element.off('click');
        await deleteAsset(assetType, asset.id);
        label.removeClass('fa-check');
        label.removeClass('redOverlayGlow');
        label.removeClass('fa-trash');
        label.addClass('fa-download');
        element.off('mouseenter').off('mouseleave');
        element.on('click', assetInstall);
    };

    if (isAssetInstalled(assetType, asset.id)) {
        console.debug(DEBUG_PREFIX, 'installed, checked');
        label.toggleClass('fa-download');
        label.toggleClass('fa-check');
        element.on('click', assetDelete);
        element.on('mouseenter', function () {
            label.removeClass('fa-check');
            label.addClass('fa-trash');
            label.addClass('redOverlayGlow');
        }).on('mouseleave', function () {
            label.addClass('fa-check');
            label.removeClass('fa-trash');
            label.removeClass('redOverlayGlow');
        });
    } else {
        console.debug(DEBUG_PREFIX, 'not installed, unchecked');
        element.prop('checked', false);
        element.on('click', assetInstall);
    }

    return element;
}

/**
 * Creates the full visual block element for a single asset.
 * @param {object} asset The asset data object, containing at least id, name, description and url fields
 * @param {string} assetType Asset type, e.g. 'extension', 'character', 'ambient', 'bgm', 'blip'
 * @param {JQuery} element The button element from createAssetButton
 * @returns {JQuery} The asset block element
 */
function createAssetBlock(asset, assetType, element) {
    console.debug(DEBUG_PREFIX, 'Created element for ', asset.id);

    const displayName = DOMPurify.sanitize(asset.name || asset.id);
    const description = DOMPurify.sanitize(asset.description || '');
    const url = isValidUrl(asset.url) ? asset.url : '';
    const title = assetType === 'extension' ? t`Extension repo/guide:` + ` ${url}` : t`Preview in browser`;
    const previewIcon = (assetType === 'extension' || assetType === 'character') ? 'fa-arrow-up-right-from-square' : 'fa-headphones-simple';
    const toolTag = assetType === 'extension' && asset.tool;
    const author = url && assetType === 'extension' ? getAuthorFromUrl(url) : EMPTY_AUTHOR;

    const nameSpan = $('<span>', { class: 'asset-name flex-container alignitemscenter' })
        .append($('<b>').text(displayName))
        .append($('<a>', { class: 'asset_preview', href: url, target: '_blank', title: title })
            .append($('<i>', { class: `fa-solid fa-sm ${previewIcon}` })));

    if (toolTag) {
        const tagSpan = $('<span>', { class: 'tag', title: t`Adds a function tool` })
            .append($('<i>', { class: 'fa-solid fa-sm fa-wrench' }))
            .append(document.createTextNode(` ${t`Tool`}`));
        nameSpan.append(tagSpan);
    }

    nameSpan.append($('<span>', { class: 'expander' }));

    if (author.name) {
        nameSpan.append($('<a>', { href: author.url, target: '_blank', class: 'asset-author-info' })
            .append($('<i>', { class: 'fa-solid fa-at fa-xs' }))
            .append($('<span>').text(author.name)));
    }

    const infoDiv = $('<div>', { class: 'flex-container flexFlowColumn flexNoGap wide100p overflowHidden' })
        .append(nameSpan)
        .append($('<small>', { class: 'asset-description' }).text(description));

    const assetBlock = $('<i></i>').append(element).append(infoDiv);

    assetBlock.find('.tag').on('click', function (e) {
        const a = document.createElement('a');
        a.href = 'https://docs.sillytavern.app/for-contributors/function-calling/';
        a.target = '_blank';
        a.click();
    });

    if (assetType === 'character') {
        if (asset.highlight) {
            nameSpan.append($('<i>', { class: 'fa-solid fa-sm fa-trophy' }));
        }
        nameSpan.prepend($('<div>', { class: 'avatar' }).append($('<img>', { src: asset.url, alt: displayName })));
    }

    assetBlock.addClass('asset-block');
    return assetBlock;
}

/**
 * Builds and appends the menu section for a single asset type.
 * @param {string} assetType Asset type, e.g. 'extension', 'character', 'ambient', 'bgm', 'blip'
 * @returns {Promise<void>}
 */
async function buildAssetTypeSection(assetType) {
    const assetTypeMenu = $('<div />', { id: `assets_${assetType}_div`, class: 'assets-list-div' });
    assetTypeMenu.attr('data-type', assetType);
    assetTypeMenu.append($('<h3>').text(KNOWN_TYPES[assetType] || assetType)).hide();

    if (assetType == 'extension') {
        assetTypeMenu.append(await renderExtensionTemplateAsync('assets', 'installation'));
    }

    for (const asset of availableAssets[assetType].sort((a, b) => a?.name && b?.name && a.name.localeCompare(b.name))) {
        const i = availableAssets[assetType].indexOf(asset);
        const element = createAssetButton(asset, assetType, i);
        const assetBlock = createAssetBlock(asset, assetType, element);

        if (assetType === 'extension') {
            const extensionBlockList = isOfficialExtension(asset.url)
                ? assetTypeMenu.find('.assets-list-extensions-official .assets-list-extensions')
                : assetTypeMenu.find('.assets-list-extensions-community .assets-list-extensions');
            extensionBlockList.append(assetBlock);
        } else {
            assetTypeMenu.append(assetBlock);
        }
    }

    assetTypeMenu.appendTo('#assets_menu');
    assetTypeMenu.on('click', 'a.asset_preview', previewAsset);
}

/**
 * Parses the fetched assets JSON and renders the full assets menu.
 * @param {object[]} json Array of asset objects, each containing at least id, name, description, url and type fields
 */
async function populateAssetsMenu(json) {
    availableAssets = {};
    $('#assets_menu').empty();

    console.debug(DEBUG_PREFIX, 'Received assets dictionary', json);

    for (const i of json) {
        if (availableAssets[i.type] === undefined)
            availableAssets[i.type] = [];
        availableAssets[i.type].push(i);
    }

    console.debug(DEBUG_PREFIX, 'Updated available assets to', availableAssets);
    // First extensions, then everything else
    const assetTypes = Object.keys(availableAssets).sort((a, b) => (a === 'extension') ? -1 : (b === 'extension') ? 1 : 0);

    $('#assets_type_select').empty();
    $('#assets_search').val('');
    $('#assets_type_select').append($('<option />', { value: '', text: t`All` }));

    for (const type of assetTypes) {
        const text = translate(KNOWN_TYPES[type] || type);
        const option = $('<option />', { value: type, text: text });
        $('#assets_type_select').append(option);
    }

    if (assetTypes.includes('extension')) {
        $('#assets_type_select').val('extension');
    }

    $('#assets_type_select').off('change').on('change', filterAssets);
    $('#assets_search').off('input').on('input', filterAssets);

    for (const assetType of assetTypes) {
        await buildAssetTypeSection(assetType);
    }

    filterAssets();
    $('#assets_filters').show();
    $('#assets_menu').show();
}

/**
 * Downloads the assets list from the given URL and populates the menu. Shows error message if something goes wrong.
 * @param {URL} url URL to fetch from
 */
async function downloadAssetsList(url) {
    await updateCurrentAssets();
    try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error('Cannot download the assets list.');
        }
        const json = await response.json();
        if (!Array.isArray(json)) {
            throw new Error('Assets list is not an array');
        }
        await populateAssetsMenu(json);
    } catch (error) {
        // Info hint if the user maybe... likely accidentally was trying to install an extension and we wanna help guide them? uwu :3
        const installButton = $('#third_party_extension_button');
        flashHighlight(installButton, 10_000);
        toastr.info('Click the flashing button at the top right corner of the menu.', 'Trying to install a custom extension?', { timeOut: 10_000 });

        // Error logged after, to appear on top
        console.error(error);
        toastr.error('Problem with assets URL', 'Cannot get assets list');
        $('#assets-connect-button').addClass('fa-plug-circle-exclamation');
        $('#assets-connect-button').addClass('redOverlayGlow');
    }
}

/**
 * Previews the asset by opening its URL. If it's an audio asset, it plays a preview sound. Otherwise, it opens the URL in a new tab.
 * @param {JQuery.Event} e Click event
 */
function previewAsset(e) {
    const href = $(this).attr('href');
    const audioExtensions = ['.mp3', '.ogg', '.wav'];

    if (audioExtensions.some(ext => href.endsWith(ext))) {
        e.preventDefault();

        if (previewAudio) {
            previewAudio.pause();

            if (previewAudio.src === href) {
                previewAudio = null;
                return;
            }
        }

        previewAudio = new Audio(href);
        previewAudio.play();
        return;
    }
}

/**
 * Checks if the asset is already installed.
 * For extensions, it checks if the extension name is in the list of installed extensions.
 * For characters, it checks if any character has the same avatar URL.
 * For other asset types, it checks if any installed asset of the same type has a URL that includes the filename.
 * @param {string} assetType Type of the asset, e.g. 'extension', 'character', 'ambient', 'bgm', 'blip'
 * @param {string} filename Name or ID of the asset
 * @returns {boolean} True if the asset is installed, false otherwise
 */
function isAssetInstalled(assetType, filename) {
    let assetList = currentAssets[assetType];

    if (assetType == 'extension') {
        const thirdPartyMarker = 'third-party/';
        assetList = extensionNames.filter(x => x.startsWith(thirdPartyMarker)).map(x => x.replace(thirdPartyMarker, ''));
    }

    if (assetType == 'character') {
        assetList = getContext().characters.map(x => x.avatar);
    }

    for (const i of assetList) {
        //console.debug(DEBUG_PREFIX,i,filename)
        if (i.includes(filename))
            return true;
    }

    return false;
}

/**
 * Installs the asset by sending a request to the server to download it. If it's an extension, it uses the existing installExtension function.
 * @param {string} url URL of the asset to download
 * @param {string} assetType Type of the asset, e.g. 'extension', 'character', 'ambient', 'bgm', 'blip'
 * @param {string} filename Name or ID of the asset
 * @returns {Promise<boolean>} True if the asset was successfully installed, false otherwise
 */
async function installAsset(url, assetType, filename) {
    console.debug(DEBUG_PREFIX, 'Downloading ', url);
    const category = assetType;
    try {
        if (category === 'extension') {
            console.debug(DEBUG_PREFIX, 'Installing extension ', url);
            const result = await installExtension(url, false);
            console.debug(DEBUG_PREFIX, 'Extension installed.');
            return result;
        }

        const body = { url, category, filename };
        const result = await fetch('/api/assets/download', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
            cache: 'no-cache',
        });
        if (result.ok) {
            console.debug(DEBUG_PREFIX, 'Download success.');
            if (category === 'character') {
                console.debug(DEBUG_PREFIX, 'Importing character ', filename);
                const blob = await result.blob();
                const file = new File([blob], filename, { type: blob.type });
                const fileNameMap = new Map([[file, filename]]);
                await processDroppedFiles([file], fileNameMap);
                console.debug(DEBUG_PREFIX, 'Character downloaded.');
            }
            return true;
        }
        return false;
    } catch (err) {
        console.log(err);
        return false;
    }
}

/**
 * Deletes the asset by sending a request to the server to delete it. If it's an extension, it uses the existing deleteExtension function.
 * @param {string} assetType Type of the asset, e.g. 'extension', 'character', 'ambient', 'bgm', 'blip'
 * @param {string} filename Name or ID of the asset
 * @returns {Promise<boolean>} True if the asset was successfully deleted, false otherwise
 */
async function deleteAsset(assetType, filename) {
    console.debug(DEBUG_PREFIX, 'Deleting ', assetType, filename);
    const category = assetType;
    try {
        if (category === 'extension') {
            console.debug(DEBUG_PREFIX, 'Deleting extension ', filename);
            await deleteExtension(filename);
            console.debug(DEBUG_PREFIX, 'Extension deleted.');
            return true;
        }

        const body = { category, filename };
        const result = await fetch('/api/assets/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
            cache: 'no-cache',
        });
        if (result.ok) {
            console.debug(DEBUG_PREFIX, 'Deletion success.');
            return true;
        }
        return false;
    } catch (err) {
        console.log(err);
        return false;
    }
}

/**
 * Opens the character browser popup, which shows all available characters and allows downloading them.
 * @param {boolean} forceDefault If true, it uses the default ASSETS_JSON_URL instead of the one from the input field.
 * @returns {Promise<void>}
 */
async function openCharacterBrowser(forceDefault) {
    const url = forceDefault ? ASSETS_JSON_URL : String($('#assets-json-url-field').val());
    if (!isValidUrl(url)) {
        toastr.error('Please enter a valid URL');
        return;
    }
    const fetchResult = await fetch(url, { cache: 'no-cache' });
    if (!fetchResult.ok) {
        toastr.error('Cannot download the assets list.');
        return;
    }
    const json = await fetchResult.json();
    if (!Array.isArray(json)) {
        toastr.error('Assets list is not an array');
        return;
    }
    const characters = json.filter(x => x && x.type === 'character');
    if (!characters.length) {
        toastr.error('No characters found in the assets list', 'Character browser');
        return;
    }

    const template = $(await renderExtensionTemplateAsync(MODULE_NAME, 'market', {}));

    for (const character of characters.sort((a, b) => a.name.localeCompare(b.name))) {
        const listElement = template.find(character.highlight ? '.contestWinnersList' : '.featuredCharactersList');
        const characterElement = $(await renderExtensionTemplateAsync(MODULE_NAME, 'character', character));
        const downloadButton = characterElement.find('.characterAssetDownloadButton');
        const checkMark = characterElement.find('.characterAssetCheckMark');
        const isInstalled = isAssetInstalled('character', character.id);

        downloadButton.toggle(!isInstalled).on('click', async () => {
            downloadButton.toggleClass('fa-download fa-spinner fa-spin');
            const result = await installAsset(character.url, 'character', character.id);
            if (result) {
                downloadButton.hide();
                checkMark.show();
            } else {
                downloadButton.toggleClass('fa-download fa-spinner fa-spin');
            }
        });

        checkMark.toggle(isInstalled).on('click', async () => {
            toastr.error('Go to the characters menu to delete a character.', 'Character deletion not supported');
            await SlashCommandParser.commands.go.callback(null, character.id);
        });

        listElement.append(characterElement);
    }

    callGenericPopup(template, POPUP_TYPE.TEXT, '', { okButton: 'Close', wide: true, large: true, allowVerticalScrolling: true, allowHorizontalScrolling: false });
}

//#############################//
//  API Calls                  //
//#############################//

async function updateCurrentAssets() {
    console.debug(DEBUG_PREFIX, 'Checking installed assets...');
    try {
        const result = await fetch('/api/assets/get', {
            method: 'POST',
            headers: getRequestHeaders({ omitContentType: true }),
        });
        currentAssets = result.ok ? (await result.json()) : {};
    } catch (err) {
        console.log(err);
    }
    console.debug(DEBUG_PREFIX, 'Current assets found:', currentAssets);
}


//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
export async function init() {
    // This is an example of loading HTML from a file
    const windowTemplate = await renderExtensionTemplateAsync(MODULE_NAME, 'window', {});
    const windowHtml = $(windowTemplate);

    const assetsJsonUrl = windowHtml.find('#assets-json-url-field');
    assetsJsonUrl.val(ASSETS_JSON_URL);

    const charactersButton = windowHtml.find('#assets-characters-button');
    charactersButton.on('click', async function () {
        openCharacterBrowser(false);
    });

    const installHintButton = windowHtml.find('.assets-install-hint-link');
    installHintButton.on('click', async function () {
        const installButton = $('#third_party_extension_button');
        flashHighlight(installButton, 5000);
        toastr.info(t`Click the flashing button to install extensions.`, t`How to install extensions?`);
    });

    const connectButton = windowHtml.find('#assets-connect-button');
    connectButton.on('click', async function () {
        const urlString = String(assetsJsonUrl.val()).trim();
        if (!isValidUrl(urlString)) {
            toastr.error('Please enter a valid URL');
            return;
        }
        const url = new URL(urlString);
        const rememberKey = `Assets_SkipConfirm_${getStringHash(url.href)}`;
        const skipConfirm = accountStorage.getItem(rememberKey) === 'true';

        const confirmation = skipConfirm || await Popup.show.confirm(t`Loading Asset List`, '<span>' + t`Are you sure you want to connect to the following url?` + `</span><var>${escapeHtml(url.href)}</var>`, {
            customInputs: [{ id: 'assets-remember', label: 'Don\'t ask again for this URL' }],
            onClose: popup => {
                if (popup.result) {
                    const rememberValue = popup.inputResults.get('assets-remember');
                    accountStorage.setItem(rememberKey, String(rememberValue));
                }
            },
        });

        if (confirmation) {
            try {
                console.debug(DEBUG_PREFIX, 'Confimation, loading assets...');
                downloadAssetsList(url);
                connectButton.removeClass('fa-plug-circle-exclamation');
                connectButton.removeClass('redOverlayGlow');
                connectButton.addClass('fa-plug-circle-check');
            } catch (error) {
                console.error('Error:', error);
                toastr.error(`Cannot get assets list from ${url.href}`);
                connectButton.removeClass('fa-plug-circle-check');
                connectButton.addClass('fa-plug-circle-exclamation');
                connectButton.removeClass('redOverlayGlow');
            }
        } else {
            console.debug(DEBUG_PREFIX, 'Connection refused by user');
        }
    });

    windowHtml.find('#assets_filters').hide();
    $('#assets_container').append(windowHtml);

    eventSource.on(event_types.OPEN_CHARACTER_LIBRARY, async (forceDefault) => {
        openCharacterBrowser(forceDefault);
    });
}
