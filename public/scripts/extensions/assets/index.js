/*
TODO:
*/
//const DEBUG_TONY_SAMA_FORK_MODE = true

import { getRequestHeaders, processDroppedFiles, eventSource, event_types } from '../../../script.js';
import { deleteExtension, extensionNames, getContext, installExtension, renderExtensionTemplateAsync } from '../../extensions.js';
import { POPUP_TYPE, Popup, callGenericPopup } from '../../popup.js';
import { executeSlashCommands } from '../../slash-commands.js';
import { flashHighlight, getStringHash, isValidUrl } from '../../utils.js';
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
    'extension': 'Extensions',
    'character': 'Characters',
    'ambient': 'Ambient sounds',
    'bgm': 'Background music',
    'blip': 'Blip sounds',
};

function downloadAssetsList(url) {
    updateCurrentAssets().then(function () {
        fetch(url, { cache: 'no-cache' })
            .then(response => response.json())
            .then(json => {

                availableAssets = {};
                $('#assets_menu').empty();

                console.debug(DEBUG_PREFIX, 'Received assets dictionary', json);

                for (const i of json) {
                    //console.log(DEBUG_PREFIX,i)
                    if (availableAssets[i['type']] === undefined)
                        availableAssets[i['type']] = [];

                    availableAssets[i['type']].push(i);
                }

                console.debug(DEBUG_PREFIX, 'Updated available assets to', availableAssets);
                // First extensions, then everything else
                const assetTypes = Object.keys(availableAssets).sort((a, b) => (a === 'extension') ? -1 : (b === 'extension') ? 1 : 0);

                $('#assets_type_select').empty();
                $('#assets_search').val('');
                $('#assets_type_select').append($('<option />', { value: '', text: 'All' }));

                for (const type of assetTypes) {
                    const option = $('<option />', { value: type, text: KNOWN_TYPES[type] || type });
                    $('#assets_type_select').append(option);
                }

                if (assetTypes.includes('extension')) {
                    $('#assets_type_select').val('extension');
                }

                $('#assets_type_select').off('change').on('change', filterAssets);
                $('#assets_search').off('input').on('input', filterAssets);

                for (const assetType of assetTypes) {
                    let assetTypeMenu = $('<div />', { id: 'assets_audio_ambient_div', class: 'assets-list-div' });
                    assetTypeMenu.attr('data-type', assetType);
                    assetTypeMenu.append(`<h3>${KNOWN_TYPES[assetType] || assetType}</h3>`).hide();

                    if (assetType == 'extension') {
                        assetTypeMenu.append(`
                        <div class="assets-list-git">
                            To download extensions from this page, you need to have <a href="https://git-scm.com/downloads" target="_blank">Git</a> installed.<br>
                            Click the <i class="fa-solid fa-sm fa-arrow-up-right-from-square"></i> icon to visit the Extension's repo for tips on how to use it.
                        </div>`);
                    }

                    for (const i in availableAssets[assetType].sort((a, b) => a?.name && b?.name && a['name'].localeCompare(b['name']))) {
                        const asset = availableAssets[assetType][i];
                        const elemId = `assets_install_${assetType}_${i}`;
                        let element = $('<div />', { id: elemId, class: 'asset-download-button right_menu_button' });
                        const label = $('<i class="fa-fw fa-solid fa-download fa-lg"></i>');
                        element.append(label);

                        //if (DEBUG_TONY_SAMA_FORK_MODE)
                        //    asset["url"] = asset["url"].replace("https://github.com/SillyTavern/","https://github.com/Tony-sama/"); // DBG

                        console.debug(DEBUG_PREFIX, 'Checking asset', asset['id'], asset['url']);

                        const assetInstall = async function () {
                            element.off('click');
                            label.removeClass('fa-download');
                            this.classList.add('asset-download-button-loading');
                            await installAsset(asset['url'], assetType, asset['id']);
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
                                await executeSlashCommands(`/go ${asset['id']}`);
                                return;
                            }
                            element.off('click');
                            await deleteAsset(assetType, asset['id']);
                            label.removeClass('fa-check');
                            label.removeClass('redOverlayGlow');
                            label.removeClass('fa-trash');
                            label.addClass('fa-download');
                            element.off('mouseenter').off('mouseleave');
                            element.on('click', assetInstall);
                        };

                        if (isAssetInstalled(assetType, asset['id'])) {
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
                        }
                        else {
                            console.debug(DEBUG_PREFIX, 'not installed, unchecked');
                            element.prop('checked', false);
                            element.on('click', assetInstall);
                        }

                        console.debug(DEBUG_PREFIX, 'Created element for ', asset['id']);

                        const displayName = DOMPurify.sanitize(asset['name'] || asset['id']);
                        const description = DOMPurify.sanitize(asset['description'] || '');
                        const url = isValidUrl(asset['url']) ? asset['url'] : '';
                        const title = assetType === 'extension' ? `Extension repo/guide: ${url}` : 'Preview in browser';
                        const previewIcon = (assetType === 'extension' || assetType === 'character') ? 'fa-arrow-up-right-from-square' : 'fa-headphones-simple';

                        const assetBlock = $('<i></i>')
                            .append(element)
                            .append(`<div class="flex-container flexFlowColumn flexNoGap">
                                        <span class="asset-name flex-container alignitemscenter">
                                            <b>${displayName}</b>
                                            <a class="asset_preview" href="${url}" target="_blank" title="${title}">
                                                <i class="fa-solid fa-sm ${previewIcon}"></i>
                                            </a>
                                        </span>
                                        <small class="asset-description">
                                            ${description}
                                        </small>
                                     </div>`);

                        if (assetType === 'character') {
                            if (asset.highlight) {
                                assetBlock.find('.asset-name').append('<i class="fa-solid fa-sm fa-trophy"></i>');
                            }
                            assetBlock.find('.asset-name').prepend(`<div class="avatar"><img src="${asset['url']}" alt="${displayName}"></div>`);
                        }

                        assetBlock.addClass('asset-block');

                        assetTypeMenu.append(assetBlock);
                    }
                    assetTypeMenu.appendTo('#assets_menu');
                    assetTypeMenu.on('click', 'a.asset_preview', previewAsset);
                }

                filterAssets();
                $('#assets_filters').show();
                $('#assets_menu').show();
            })
            .catch((error) => {
                // Info hint if the user maybe... likely accidently was trying to install an extension and we wanna help guide them? uwu :3
                const installButton = $('#third_party_extension_button');
                flashHighlight(installButton, 10_000);
                toastr.info('Click the flashing button at the top right corner of the menu.', 'Trying to install a custom extension?', { timeOut: 10_000 });

                // Error logged after, to appear on top
                console.error(error);
                toastr.error('Problem with assets URL', DEBUG_PREFIX + 'Cannot get assets list');
                $('#assets-connect-button').addClass('fa-plug-circle-exclamation');
                $('#assets-connect-button').addClass('redOverlayGlow');
            });
    });
}

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

async function installAsset(url, assetType, filename) {
    console.debug(DEBUG_PREFIX, 'Downloading ', url);
    const category = assetType;
    try {
        if (category === 'extension') {
            console.debug(DEBUG_PREFIX, 'Installing extension ', url);
            await installExtension(url);
            console.debug(DEBUG_PREFIX, 'Extension installed.');
            return;
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
                await processDroppedFiles([file], true);
                console.debug(DEBUG_PREFIX, 'Character downloaded.');
            }
        }
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

async function deleteAsset(assetType, filename) {
    console.debug(DEBUG_PREFIX, 'Deleting ', assetType, filename);
    const category = assetType;
    try {
        if (category === 'extension') {
            console.debug(DEBUG_PREFIX, 'Deleting extension ', filename);
            await deleteExtension(filename);
            console.debug(DEBUG_PREFIX, 'Extension deleted.');
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
        }
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

async function openCharacterBrowser(forceDefault) {
    const url = forceDefault ? ASSETS_JSON_URL : String($('#assets-json-url-field').val());
    const fetchResult = await fetch(url, { cache: 'no-cache' });
    const json = await fetchResult.json();
    const characters = json.filter(x => x.type === 'character');

    if (!characters.length) {
        toastr.error('No characters found in the assets list', 'Character browser');
        return;
    }

    const template = $(await renderExtensionTemplateAsync(MODULE_NAME, 'market', {}));

    for (const character of characters.sort((a, b) => a.name.localeCompare(b.name))) {
        const listElement = template.find(character.highlight ? '.contestWinnersList' : '.featuredCharactersList');
        const characterElement = $(await renderExtensionTemplateAsync(MODULE_NAME, 'character', character));
        const downloadButton  = characterElement.find('.characterAssetDownloadButton');
        const checkMark = characterElement.find('.characterAssetCheckMark');
        const isInstalled = isAssetInstalled('character', character.id);

        downloadButton.toggle(!isInstalled).on('click', async () => {
            downloadButton.toggleClass('fa-download fa-spinner fa-spin');
            await installAsset(character.url, 'character', character.id);
            downloadButton.hide();
            checkMark.show();
        });

        checkMark.toggle(isInstalled);

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
            headers: getRequestHeaders(),
        });
        currentAssets = result.ok ? (await result.json()) : {};
    }
    catch (err) {
        console.log(err);
    }
    console.debug(DEBUG_PREFIX, 'Current assets found:', currentAssets);
}


//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
jQuery(async () => {
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
        toastr.info('Click the flashing button to install extensions.', 'How to install extensions?');
    });

    const connectButton = windowHtml.find('#assets-connect-button');
    connectButton.on('click', async function () {
        const url = DOMPurify.sanitize(String(assetsJsonUrl.val()));
        const rememberKey = `Assets_SkipConfirm_${getStringHash(url)}`;
        const skipConfirm = localStorage.getItem(rememberKey) === 'true';

        const confirmation = skipConfirm || await Popup.show.confirm('Loading Asset List', `<span>Are you sure you want to connect to the following url?</span><var>${url}</var>`, {
            customInputs: [{ id: 'assets-remember', label: 'Don\'t ask again for this URL' }],
            onClose: popup => {
                if (popup.result) {
                    const rememberValue = popup.inputResults.get('assets-remember');
                    localStorage.setItem(rememberKey, String(rememberValue));
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
                toastr.error(`Cannot get assets list from ${url}`);
                connectButton.removeClass('fa-plug-circle-check');
                connectButton.addClass('fa-plug-circle-exclamation');
                connectButton.removeClass('redOverlayGlow');
            }
        }
        else {
            console.debug(DEBUG_PREFIX, 'Connection refused by user');
        }
    });

    windowHtml.find('#assets_filters').hide();
    $('#assets_container').append(windowHtml);

    eventSource.on(event_types.OPEN_CHARACTER_LIBRARY, async (forceDefault) => {
        openCharacterBrowser(forceDefault);
    });
});
