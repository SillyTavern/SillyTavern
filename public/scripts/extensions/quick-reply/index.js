import { saveSettingsDebounced, callPopup, getRequestHeaders, substituteParams, eventSource, event_types, animation_duration } from '../../../script.js';
import { getContext, extension_settings } from '../../extensions.js';
import { getSortableDelay, escapeHtml, delay } from '../../utils.js';
import { executeSlashCommands, registerSlashCommand } from '../../slash-commands.js';
import { ContextMenu } from './src/ContextMenu.js';
import { MenuItem } from './src/MenuItem.js';
import { MenuHeader } from './src/MenuHeader.js';
import { loadMovingUIState } from '../../power-user.js';
import { dragElement } from '../../RossAscends-mods.js';

export { MODULE_NAME };

const MODULE_NAME = 'quick-reply';
const UPDATE_INTERVAL = 1000;
let presets = [];
let selected_preset = '';

const defaultSettings = {
    quickReplyEnabled: false,
    numberOfSlots: 5,
    quickReplySlots: [],
    placeBeforeInputEnabled: false,
    quickActionEnabled: false,
    AutoInputInject: true,
};

//method from worldinfo
async function updateQuickReplyPresetList() {
    const result = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (result.ok) {
        var data = await result.json();
        presets = data.quickReplyPresets?.length ? data.quickReplyPresets : [];
        console.debug('Quick Reply presets', presets);
        $('#quickReplyPresets').find('option[value!=""]').remove();


        if (presets !== undefined) {
            presets.forEach((item) => {
                const option = document.createElement('option');
                option.value = item.name;
                option.innerText = item.name;
                option.selected = selected_preset.includes(item.name);
                $('#quickReplyPresets').append(option);
            });
        }
    }
}

async function loadSettings(type) {
    if (type === 'init') {
        await updateQuickReplyPresetList();
    }
    if (Object.keys(extension_settings.quickReply).length === 0) {
        Object.assign(extension_settings.quickReply, defaultSettings);
    }

    if (extension_settings.quickReply.AutoInputInject === undefined) {
        extension_settings.quickReply.AutoInputInject = true;
    }

    // If the user has an old version of the extension, update it
    if (!Array.isArray(extension_settings.quickReply.quickReplySlots)) {
        extension_settings.quickReply.quickReplySlots = [];
        extension_settings.quickReply.numberOfSlots = defaultSettings.numberOfSlots;

        for (let i = 1; i <= extension_settings.quickReply.numberOfSlots; i++) {
            extension_settings.quickReply.quickReplySlots.push({
                mes: extension_settings.quickReply[`quickReply${i}Mes`],
                label: extension_settings.quickReply[`quickReply${i}Label`],
                enabled: true,
            });

            delete extension_settings.quickReply[`quickReply${i}Mes`];
            delete extension_settings.quickReply[`quickReply${i}Label`];
        }
    }

    initializeEmptySlots(extension_settings.quickReply.numberOfSlots);
    generateQuickReplyElements();

    for (let i = 1; i <= extension_settings.quickReply.numberOfSlots; i++) {
        $(`#quickReply${i}Mes`).val(extension_settings.quickReply.quickReplySlots[i - 1]?.mes).trigger('input');
        $(`#quickReply${i}Label`).val(extension_settings.quickReply.quickReplySlots[i - 1]?.label).trigger('input');
    }

    $('#quickReplyEnabled').prop('checked', extension_settings.quickReply.quickReplyEnabled);
    $('#quickReplyNumberOfSlots').val(extension_settings.quickReply.numberOfSlots);
    $('#placeBeforeInputEnabled').prop('checked', extension_settings.quickReply.placeBeforeInputEnabled);
    $('#quickActionEnabled').prop('checked', extension_settings.quickReply.quickActionEnabled);
    $('#AutoInputInject').prop('checked', extension_settings.quickReply.AutoInputInject);
}

function onQuickReplyInput(id) {
    extension_settings.quickReply.quickReplySlots[id - 1].mes = $(`#quickReply${id}Mes`).val();
    $(`#quickReply${id}`).attr('title', String($(`#quickReply${id}Mes`).val()));
    saveSettingsDebounced();
}

function onQuickReplyLabelInput(id) {
    extension_settings.quickReply.quickReplySlots[id - 1].label = $(`#quickReply${id}Label`).val();
    addQuickReplyBar();
    saveSettingsDebounced();
}

async function onQuickReplyContextMenuChange(id) {
    extension_settings.quickReply.quickReplySlots[id - 1].contextMenu = JSON.parse($(`#quickReplyContainer > [data-order="${id}"]`).attr('data-contextMenu'));
    saveSettingsDebounced();
}

async function onQuickReplyCtxButtonClick(id) {
    const editorHtml = $(await $.get('scripts/extensions/quick-reply/contextMenuEditor.html'));
    const popupResult = callPopup(editorHtml, 'confirm', undefined, { okButton: 'Save', wide: false, large: false, rows: 1 });
    const qr = extension_settings.quickReply.quickReplySlots[id - 1];
    if (!qr.contextMenu) {
        qr.contextMenu = [];
    }
    /**@type {HTMLTemplateElement}*/
    const tpl = document.querySelector('#quickReply_contextMenuEditor_itemTemplate');
    const fillPresetSelect = (select, item) => {
        [{ name: 'Select a preset', value: '' }, ...presets].forEach(preset => {
            const opt = document.createElement('option'); {
                opt.value = preset.value ?? preset.name;
                opt.textContent = preset.name;
                opt.selected = preset.name == item.preset;
                select.append(opt);
            }
        });
    };
    const addCtxItem = (item, idx) => {
        const dom = tpl.content.cloneNode(true);
        const ctxItem = dom.querySelector('.quickReplyContextMenuEditor_item');
        ctxItem.setAttribute('data-order', idx);
        const select = ctxItem.querySelector('.quickReply_contextMenuEditor_preset');
        fillPresetSelect(select, item);
        dom.querySelector('.quickReply_contextMenuEditor_chaining').checked = item.chain;
        $('.quickReply_contextMenuEditor_remove', ctxItem).on('click', () => ctxItem.remove());
        document.querySelector('#quickReply_contextMenuEditor_content').append(ctxItem);
    };
    [...qr.contextMenu, {}].forEach((item, idx) => {
        addCtxItem(item, idx);
    });
    $('#quickReply_contextMenuEditor_addPreset').on('click', () => {
        addCtxItem({}, document.querySelector('#quickReply_contextMenuEditor_content').children.length);
    });

    $('#quickReply_contextMenuEditor_content').sortable({
        delay: getSortableDelay(),
        stop: () => { },
    });

    $('#quickReply_autoExecute_userMessage').prop('checked', qr.autoExecute_userMessage ?? false);
    $('#quickReply_autoExecute_botMessage').prop('checked', qr.autoExecute_botMessage ?? false);
    $('#quickReply_autoExecute_chatLoad').prop('checked', qr.autoExecute_chatLoad ?? false);
    $('#quickReply_autoExecute_appStartup').prop('checked', qr.autoExecute_appStartup ?? false);
    $('#quickReply_hidden').prop('checked', qr.hidden ?? false);

    $('#quickReply_hidden').on('input', () => {
        const state = !!$('#quickReply_hidden').prop('checked');
        qr.hidden = state;
        saveSettingsDebounced();
    });

    $('#quickReply_autoExecute_appStartup').on('input', () => {
        const state = !!$('#quickReply_autoExecute_appStartup').prop('checked');
        qr.autoExecute_appStartup = state;
        saveSettingsDebounced();
    });

    $('#quickReply_autoExecute_userMessage').on('input', () => {
        const state = !!$('#quickReply_autoExecute_userMessage').prop('checked');
        qr.autoExecute_userMessage = state;
        saveSettingsDebounced();
    });

    $('#quickReply_autoExecute_botMessage').on('input', () => {
        const state = !!$('#quickReply_autoExecute_botMessage').prop('checked');
        qr.autoExecute_botMessage = state;
        saveSettingsDebounced();
    });

    $('#quickReply_autoExecute_chatLoad').on('input', () => {
        const state = !!$('#quickReply_autoExecute_chatLoad').prop('checked');
        qr.autoExecute_chatLoad = state;
        saveSettingsDebounced();
    });

    $('#quickReply_ui_title').val(qr.title ?? '');

    if (await popupResult) {
        qr.contextMenu = Array.from(document.querySelectorAll('#quickReply_contextMenuEditor_content > .quickReplyContextMenuEditor_item'))
            .map(item => ({
                preset: item.querySelector('.quickReply_contextMenuEditor_preset').value,
                chain: item.querySelector('.quickReply_contextMenuEditor_chaining').checked,
            }))
            .filter(item => item.preset);
        $(`#quickReplyContainer[data-order="${id}"]`).attr('data-contextMenu', JSON.stringify(qr.contextMenu));
        qr.title = $('#quickReply_ui_title').val();
        saveSettingsDebounced();
        updateQuickReplyPreset();
        onQuickReplyLabelInput(id);
    }
}

async function onQuickReplyEnabledInput() {
    let isEnabled = $(this).prop('checked');
    extension_settings.quickReply.quickReplyEnabled = !!isEnabled;
    if (isEnabled === true) {
        $('#quickReplyBar').show();
    } else { $('#quickReplyBar').hide(); }
    saveSettingsDebounced();
}

// New function to handle input on quickActionEnabled
async function onQuickActionEnabledInput() {
    extension_settings.quickReply.quickActionEnabled = !!$(this).prop('checked');
    saveSettingsDebounced();
}

async function onPlaceBeforeInputEnabledInput() {
    extension_settings.quickReply.placeBeforeInputEnabled = !!$(this).prop('checked');
    saveSettingsDebounced();
}

async function onAutoInputInject() {
    extension_settings.quickReply.AutoInputInject = !!$(this).prop('checked');
    saveSettingsDebounced();
}

async function sendQuickReply(index) {
    const prompt = extension_settings.quickReply.quickReplySlots[index]?.mes || '';
    return await performQuickReply(prompt, index);
}

async function executeQuickReplyByName(name) {
    if (!extension_settings.quickReply.quickReplyEnabled) {
        throw new Error('Quick Reply is disabled');
    }

    let qr = extension_settings.quickReply.quickReplySlots.find(x => x.label == name);

    if (!qr && name.includes('.')) {
        const [presetName, qrName] = name.split('.');
        const preset = presets.find(x => x.name == presetName);
        if (preset) {
            qr = preset.quickReplySlots.find(x => x.label == qrName);
        }
    }

    if (!qr) {
        throw new Error(`Quick Reply "${name}" not found`);
    }

    return await performQuickReply(qr.mes);
}

window['executeQuickReplyByName'] = executeQuickReplyByName;

async function performQuickReply(prompt, index) {
    if (!prompt) {
        console.warn(`Quick reply slot ${index} is empty! Aborting.`);
        return;
    }
    const existingText = $('#send_textarea').val();

    let newText;

    if (existingText && extension_settings.quickReply.AutoInputInject) {
        if (extension_settings.quickReply.placeBeforeInputEnabled) {
            newText = `${prompt} ${existingText} `;
        } else {
            newText = `${existingText} ${prompt} `;
        }
    } else {
        // If no existing text and placeBeforeInputEnabled false, add prompt only (with a trailing space)
        newText = `${prompt} `;
    }

    // the prompt starts with '/' - execute slash commands natively
    if (prompt.startsWith('/')) {
        const result = await executeSlashCommands(newText);
        return typeof result === 'object' ? result?.pipe : '';
    }

    newText = substituteParams(newText);

    $('#send_textarea').val(newText);

    // Set the focus back to the textarea
    $('#send_textarea').trigger('focus');

    // Only trigger send button if quickActionEnabled is not checked or
    if (!extension_settings.quickReply.quickActionEnabled) {
        $('#send_but').trigger('click');
    }
}


function buildContextMenu(qr, chainMes = null, hierarchy = [], labelHierarchy = []) {
    const tree = {
        label: qr.label,
        mes: (chainMes && qr.mes ? `${chainMes} | ` : '') + qr.mes,
        children: [],
    };
    qr.contextMenu?.forEach(ctxItem => {
        let chain = ctxItem.chain;
        let subName = ctxItem.preset;
        const sub = presets.find(it => it.name == subName);
        if (sub) {
            // prevent circular references
            if (hierarchy.indexOf(sub.name) == -1) {
                const nextHierarchy = [...hierarchy, sub.name];
                const nextLabelHierarchy = [...labelHierarchy, tree.label];
                tree.children.push(new MenuHeader(sub.name));
                sub.quickReplySlots.forEach(subQr => {
                    const subInfo = buildContextMenu(subQr, chain ? tree.mes : null, nextHierarchy, nextLabelHierarchy);
                    tree.children.push(new MenuItem(
                        subInfo.label,
                        subInfo.mes,
                        (evt) => {
                            evt.stopPropagation();
                            performQuickReply(subInfo.mes.replace(/%%parent(-\d+)?%%/g, (_, index) => {
                                return nextLabelHierarchy.slice(parseInt(index ?? '-1'))[0];
                            }));
                        },
                        subInfo.children,
                    ));
                });
            }
        }
    });
    return tree;
}

async function doQuickReplyBarPopout() {
    //shared elements
    const newQuickRepliesDiv = '<div id="quickReplies"></div>';
    const popoutButtonClone = $('#quickReplyPopoutButton');

    if ($('#quickReplyBarPopout').length === 0) {
        console.debug('did not see popout yet, creating');
        const template = $('#zoomed_avatar_template').html();
        const controlBarHtml = `<div class="panelControlBar flex-container">
        <div id="quickReplyBarPopoutheader" class="fa-solid fa-grip drag-grabber hoverglow"></div>
        <div id="quickReplyBarPopoutClose" class="fa-solid fa-circle-xmark hoverglow"></div>
        </div>`;
        const newElement = $(template);
        let quickRepliesClone = $('#quickReplies').html();
        newElement.attr('id', 'quickReplyBarPopout')
            .removeClass('zoomed_avatar')
            .addClass('draggable scrollY')
            .empty()
            .append(controlBarHtml)
            .append(newQuickRepliesDiv);
        //empty original bar
        $('#quickReplyBar').empty();
        //add clone in popout
        $('body').append(newElement);
        $('#quickReplies').append(quickRepliesClone).css('margin-top', '1em');
        $('.quickReplyButton').on('click', function () {
            let index = $(this).data('index');
            sendQuickReply(index);
        });
        $('.quickReplyButton > .ctx-expander').on('click', function (evt) {
            evt.stopPropagation();
            let index = $(this.closest('.quickReplyButton')).data('index');
            const qr = extension_settings.quickReply.quickReplySlots[index];
            if (qr.contextMenu?.length) {
                evt.preventDefault();
                const tree = buildContextMenu(qr);
                const menu = new ContextMenu(tree.children);
                menu.show(evt);
            }
        });
        $('.quickReplyButton').on('contextmenu', function (evt) {
            let index = $(this).data('index');
            const qr = extension_settings.quickReply.quickReplySlots[index];
            if (qr.contextMenu?.length) {
                evt.preventDefault();
                const tree = buildContextMenu(qr);
                const menu = new ContextMenu(tree.children);
                menu.show(evt);
            }
        });

        loadMovingUIState();
        $('#quickReplyBarPopout').fadeIn(animation_duration);
        dragElement(newElement);

        $('#quickReplyBarPopoutClose').off('click').on('click', function () {
            console.debug('saw existing popout, removing');
            let quickRepliesClone = $('#quickReplies').html();
            $('#quickReplyBar').append(newQuickRepliesDiv);
            $('#quickReplies').prepend(quickRepliesClone);
            $('#quickReplyBar').append(popoutButtonClone).fadeIn(animation_duration);
            $('#quickReplyBarPopout').fadeOut(animation_duration, () => { $('#quickReplyBarPopout').remove(); });
            $('.quickReplyButton').on('click', function () {
                let index = $(this).data('index');
                sendQuickReply(index);
            });
            $('.quickReplyButton > .ctx-expander').on('click', function (evt) {
                evt.stopPropagation();
                let index = $(this.closest('.quickReplyButton')).data('index');
                const qr = extension_settings.quickReply.quickReplySlots[index];
                if (qr.contextMenu?.length) {
                    evt.preventDefault();
                    const tree = buildContextMenu(qr);
                    const menu = new ContextMenu(tree.children);
                    menu.show(evt);
                }
            });
            $('.quickReplyButton').on('contextmenu', function (evt) {
                let index = $(this).data('index');
                const qr = extension_settings.quickReply.quickReplySlots[index];
                if (qr.contextMenu?.length) {
                    evt.preventDefault();
                    const tree = buildContextMenu(qr);
                    const menu = new ContextMenu(tree.children);
                    menu.show(evt);
                }
            });
            $('#quickReplyPopoutButton').off('click').on('click', doQuickReplyBarPopout);
        });

    }
}

function addQuickReplyBar() {
    let quickReplyButtonHtml = '';
    var targetContainer;
    if ($('#quickReplyBarPopout').length !== 0) {
        targetContainer = 'popout';
    } else {
        targetContainer = 'bar';
        $('#quickReplyBar').remove();
    }

    for (let i = 0; i < extension_settings.quickReply.numberOfSlots; i++) {
        const qr = extension_settings.quickReply.quickReplySlots[i];
        const quickReplyMes = qr?.mes || '';
        const quickReplyLabel = qr?.label || '';
        const hidden = qr?.hidden ?? false;
        let expander = '';
        if (extension_settings.quickReply.quickReplySlots[i]?.contextMenu?.length) {
            expander = '<span class="ctx-expander" title="Open context menu">⋮</span>';
        }
        quickReplyButtonHtml += `<div title="${escapeHtml(qr.title || quickReplyMes)}" class="quickReplyButton ${hidden ? 'displayNone' : ''}" data-index="${i}" id="quickReply${i + 1}">${DOMPurify.sanitize(quickReplyLabel)}${expander}</div>`;
    }

    const quickReplyBarFullHtml = `
        <div id="quickReplyBar" class="flex-container flexGap5">
            <div id="quickReplies">
                ${quickReplyButtonHtml}
            </div>
            <div id="quickReplyPopoutButton" class="fa-solid fa-window-restore menu_button"></div>
        </div>
    `;

    if (targetContainer === 'bar') {
        $('#send_form').prepend(quickReplyBarFullHtml);
    } else {
        $('#quickReplies').empty().append(quickReplyButtonHtml);
    }


    $('.quickReplyButton').on('click', function () {
        let index = $(this).data('index');
        sendQuickReply(index);
    });
    $('#quickReplyPopoutButton').off('click').on('click', doQuickReplyBarPopout);
    $('.quickReplyButton > .ctx-expander').on('click', function (evt) {
        evt.stopPropagation();
        let index = $(this.closest('.quickReplyButton')).data('index');
        const qr = extension_settings.quickReply.quickReplySlots[index];
        if (qr.contextMenu?.length) {
            evt.preventDefault();
            const tree = buildContextMenu(qr);
            const menu = new ContextMenu(tree.children);
            menu.show(evt);
        }
    });
    $('.quickReplyButton').on('contextmenu', function (evt) {
        let index = $(this).data('index');
        const qr = extension_settings.quickReply.quickReplySlots[index];
        if (qr.contextMenu?.length) {
            evt.preventDefault();
            const tree = buildContextMenu(qr);
            const menu = new ContextMenu(tree.children);
            menu.show(evt);
        }
    });
}

async function moduleWorker() {
    if (extension_settings.quickReply.quickReplyEnabled === true) {
        $('#quickReplyBar').toggle(getContext().onlineStatus !== 'no_connection');
    }
    if (extension_settings.quickReply.selectedPreset) {
        selected_preset = extension_settings.quickReply.selectedPreset;
    }
}

async function saveQuickReplyPreset() {
    const name = await callPopup('Enter a name for the Quick Reply Preset:', 'input');

    if (!name) {
        return;
    }

    const quickReplyPreset = {
        name: name,
        quickReplyEnabled: extension_settings.quickReply.quickReplyEnabled,
        quickReplySlots: extension_settings.quickReply.quickReplySlots,
        numberOfSlots: extension_settings.quickReply.numberOfSlots,
        AutoInputInject: extension_settings.quickReply.AutoInputInject,
        selectedPreset: name,
    };

    const response = await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(quickReplyPreset),
    });

    if (response.ok) {
        const quickReplyPresetIndex = presets.findIndex(x => x.name == name);

        if (quickReplyPresetIndex == -1) {
            presets.push(quickReplyPreset);
            const option = document.createElement('option');
            option.selected = true;
            option.value = name;
            option.innerText = name;
            $('#quickReplyPresets').append(option);
        }
        else {
            presets[quickReplyPresetIndex] = quickReplyPreset;
            $(`#quickReplyPresets option[value="${name}"]`).prop('selected', true);
        }
        saveSettingsDebounced();
    } else {
        toastr.warning('Failed to save Quick Reply Preset.');
    }
}

//just a copy of save function with the name hardcoded to currently selected preset
async function updateQuickReplyPreset() {
    const name = $('#quickReplyPresets').val();

    if (!name) {
        return;
    }

    const quickReplyPreset = {
        name: name,
        quickReplyEnabled: extension_settings.quickReply.quickReplyEnabled,
        quickReplySlots: extension_settings.quickReply.quickReplySlots,
        numberOfSlots: extension_settings.quickReply.numberOfSlots,
        AutoInputInject: extension_settings.quickReply.AutoInputInject,
        selectedPreset: name,
    };

    const response = await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(quickReplyPreset),
    });

    if (response.ok) {
        const quickReplyPresetIndex = presets.findIndex(x => x.name == name);

        if (quickReplyPresetIndex == -1) {
            presets.push(quickReplyPreset);
            const option = document.createElement('option');
            option.selected = true;
            option.value = name;
            option.innerText = name;
            $('#quickReplyPresets').append(option);
        }
        else {
            presets[quickReplyPresetIndex] = quickReplyPreset;
            $(`#quickReplyPresets option[value="${name}"]`).prop('selected', true);
        }
        saveSettingsDebounced();
    } else {
        toastr.warning('Failed to save Quick Reply Preset.');
    }
}

async function onQuickReplyNumberOfSlotsInput() {
    const $input = $('#quickReplyNumberOfSlots');
    let numberOfSlots = Number($input.val());

    if (isNaN(numberOfSlots)) {
        numberOfSlots = defaultSettings.numberOfSlots;
    }

    // Clamp min and max values (from input attributes)
    if (numberOfSlots < Number($input.attr('min'))) {
        numberOfSlots = Number($input.attr('min'));
    } else if (numberOfSlots > Number($input.attr('max'))) {
        numberOfSlots = Number($input.attr('max'));
    }

    extension_settings.quickReply.numberOfSlots = numberOfSlots;
    extension_settings.quickReply.quickReplySlots.length = numberOfSlots;

    // Initialize new slots
    initializeEmptySlots(numberOfSlots);

    await loadSettings();
    addQuickReplyBar();
    moduleWorker();
    saveSettingsDebounced();
}

function initializeEmptySlots(numberOfSlots) {
    for (let i = 0; i < numberOfSlots; i++) {
        if (!extension_settings.quickReply.quickReplySlots[i]) {
            extension_settings.quickReply.quickReplySlots[i] = {
                mes: '',
                label: '',
                enabled: true,
            };
        }
    }
}

function generateQuickReplyElements() {
    let quickReplyHtml = '';

    for (let i = 1; i <= extension_settings.quickReply.numberOfSlots; i++) {
        quickReplyHtml += `
        <div class="flex-container alignitemscenter" data-order="${i}">
            <span class="drag-handle ui-sortable-handle">☰</span>
            <input class="text_pole wide30p" id="quickReply${i}Label" placeholder="(Button label)">
            <span class="menu_button menu_button_icon" id="quickReply${i}CtxButton" title="Additional options: context menu, auto-execution">⋮</span>
            <span class="menu_button menu_button_icon editor_maximize fa-solid fa-maximize" data-tab="true" data-for="quickReply${i}Mes" id="quickReply${i}ExpandButton" title="Expand the editor"></span>
            <textarea id="quickReply${i}Mes" placeholder="(Custom message or /command)" class="text_pole widthUnset flex1" rows="2"></textarea>
        </div>
        `;
    }

    $('#quickReplyContainer').empty().append(quickReplyHtml);

    for (let i = 1; i <= extension_settings.quickReply.numberOfSlots; i++) {
        $(`#quickReply${i}Mes`).on('input', function () { onQuickReplyInput(this.closest('[data-order]').getAttribute('data-order')); });
        $(`#quickReply${i}Label`).on('input', function () { onQuickReplyLabelInput(this.closest('[data-order]').getAttribute('data-order')); });
        $(`#quickReply${i}CtxButton`).on('click', function () { onQuickReplyCtxButtonClick(this.closest('[data-order]').getAttribute('data-order')); });
        $(`#quickReplyContainer > [data-order="${i}"]`).attr('data-contextMenu', JSON.stringify(extension_settings.quickReply.quickReplySlots[i - 1]?.contextMenu ?? []));
    }
}

async function applyQuickReplyPreset(name) {
    const quickReplyPreset = presets.find(x => x.name == name);

    if (!quickReplyPreset) {
        toastr.warning(`error, QR preset '${name}' not found. Confirm you are using proper case sensitivity!`);
        return;
    }

    extension_settings.quickReply = quickReplyPreset;
    extension_settings.quickReply.selectedPreset = name;
    saveSettingsDebounced();
    loadSettings('init');
    addQuickReplyBar();
    moduleWorker();

    $(`#quickReplyPresets option[value="${name}"]`).prop('selected', true);
    console.debug('QR Preset applied: ' + name);
}

async function doQRPresetSwitch(_, text) {
    text = String(text);
    applyQuickReplyPreset(text);
}

async function doQR(_, text) {
    if (!text) {
        toastr.warning('must specify which QR # to use');
        return;
    }

    text = Number(text);
    //use scale starting with 0
    //ex: user inputs "/qr 2" >> qr with data-index 1 (but 2nd item displayed) gets triggered
    let QRnum = Number(text - 1);
    if (QRnum <= 0) { QRnum = 0; }
    const whichQR = $('#quickReplies').find(`[data-index='${QRnum}']`);
    whichQR.trigger('click');
}

function saveQROrder() {
    //update html-level order data to match new sort
    let i = 1;
    $('#quickReplyContainer').children().each(function () {
        const oldOrder = $(this).attr('data-order');
        $(this).attr('data-order', i);
        $(this).find('input').attr('id', `quickReply${i}Label`);
        $(this).find('textarea').attr('id', `quickReply${i}Mes`);
        $(this).find(`#quickReply${oldOrder}CtxButton`).attr('id', `quickReply${i}CtxButton`);
        $(this).find(`#quickReply${oldOrder}ExpandButton`).attr({ 'data-for': `quickReply${i}Mes`, 'id': `quickReply${i}ExpandButton` });
        i++;
    });

    //rebuild the extension_Settings array based on new order
    i = 1;
    $('#quickReplyContainer').children().each(function () {
        onQuickReplyContextMenuChange(i);
        onQuickReplyLabelInput(i);
        onQuickReplyInput(i);
        i++;
    });
}

async function qrCreateCallback(args, mes) {
    const qr = {
        label: args.label ?? '',
        mes: (mes ?? '')
            .replace(/\\\|/g, '|')
            .replace(/\\\{/g, '{')
            .replace(/\\\}/g, '}')
        ,
        title: args.title ?? '',
        autoExecute_chatLoad: JSON.parse(args.load ?? false),
        autoExecute_userMessage: JSON.parse(args.user ?? false),
        autoExecute_botMessage: JSON.parse(args.bot ?? false),
        autoExecute_appStartup: JSON.parse(args.startup ?? false),
        hidden: JSON.parse(args.hidden ?? false),
    };
    const setName = args.set ?? selected_preset;
    const preset = presets.find(x => x.name == setName);

    if (!preset) {
        toastr.warning('Confirm you are using proper case sensitivity!', `QR preset '${setName}' not found`);
        return '';
    }

    preset.quickReplySlots.push(qr);
    preset.numberOfSlots++;
    await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(preset),
    });
    saveSettingsDebounced();
    await delay(400);
    applyQuickReplyPreset(selected_preset);
    return '';
}
async function qrUpdateCallback(args, mes) {
    const setName = args.set ?? selected_preset;
    const preset = presets.find(x => x.name == setName);

    if (!preset) {
        toastr.warning('Confirm you are using proper case sensitivity!', `QR preset '${setName}' not found`);
        return '';
    }

    const idx = preset.quickReplySlots.findIndex(x => x.label == args.label);
    const oqr = preset.quickReplySlots[idx];
    const qr = {
        label: args.newlabel ?? oqr.label ?? '',
        mes: (mes ?? oqr.mes)
            .replace('\\|', '|')
            .replace('\\{', '{')
            .replace('\\}', '}')
        ,
        title: args.title ?? oqr.title ?? '',
        autoExecute_chatLoad: JSON.parse(args.load ?? oqr.autoExecute_chatLoad ?? false),
        autoExecute_userMessage: JSON.parse(args.user ?? oqr.autoExecute_userMessage ?? false),
        autoExecute_botMessage: JSON.parse(args.bot ?? oqr.autoExecute_botMessage ?? false),
        autoExecute_appStartup: JSON.parse(args.startup ?? oqr.autoExecute_appStartup ?? false),
        hidden: JSON.parse(args.hidden ?? oqr.hidden ?? false),
    };
    preset.quickReplySlots[idx] = qr;
    await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(preset),
    });
    saveSettingsDebounced();
    await delay(400);
    applyQuickReplyPreset(selected_preset);
    return '';
}
async function qrDeleteCallback(args, label) {
    const setName = args.set ?? selected_preset;
    const preset = presets.find(x => x.name == setName);

    if (!preset) {
        toastr.warning('Confirm you are using proper case sensitivity!', `QR preset '${setName}' not found`);
        return '';
    }

    const idx = preset.quickReplySlots.findIndex(x => x.label == label);
    if (idx === -1) {
        toastr.warning('Confirm you are using proper case sensitivity!', `QR with label '${label}' not found`);
        return '';
    };
    preset.quickReplySlots.splice(idx, 1);
    preset.numberOfSlots--;
    await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(preset),
    });
    saveSettingsDebounced();
    await delay(400);
    applyQuickReplyPreset(selected_preset);
    return '';
}

async function qrContextAddCallback(args, presetName) {
    const setName = args.set ?? selected_preset;
    const preset = presets.find(x => x.name == setName);

    if (!preset) {
        toastr.warning('Confirm you are using proper case sensitivity!', `QR preset '${setName}' not found`);
        return '';
    }

    const idx = preset.quickReplySlots.findIndex(x => x.label == args.label);
    const oqr = preset.quickReplySlots[idx];
    if (!oqr.contextMenu) {
        oqr.contextMenu = [];
    }
    let item = oqr.contextMenu.find(it => it.preset == presetName);
    if (item) {
        item.chain = JSON.parse(args.chain ?? 'null') ?? item.chain ?? false;
    } else {
        oqr.contextMenu.push({ preset: presetName, chain: JSON.parse(args.chain ?? 'false') });
    }
    await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(preset),
    });
    saveSettingsDebounced();
    await delay(400);
    applyQuickReplyPreset(selected_preset);
    return '';
}
async function qrContextDeleteCallback(args, presetName) {
    const setName = args.set ?? selected_preset;
    const preset = presets.find(x => x.name == setName);

    if (!preset) {
        toastr.warning('Confirm you are using proper case sensitivity!', `QR preset '${setName}' not found`);
        return '';
    }

    const idx = preset.quickReplySlots.findIndex(x => x.label == args.label);
    const oqr = preset.quickReplySlots[idx];
    if (!oqr.contextMenu) return;
    const ctxIdx = oqr.contextMenu.findIndex(it => it.preset == presetName);
    if (ctxIdx > -1) {
        oqr.contextMenu.splice(ctxIdx, 1);
    }
    await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(preset),
    });
    saveSettingsDebounced();
    await delay(400);
    applyQuickReplyPreset(selected_preset);
    return '';
}
async function qrContextClearCallback(args, label) {
    const setName = args.set ?? selected_preset;
    const preset = presets.find(x => x.name == setName);

    if (!preset) {
        toastr.warning('Confirm you are using proper case sensitivity!', `QR preset '${setName}' not found`);
        return '';
    }

    const idx = preset.quickReplySlots.findIndex(x => x.label == label);
    const oqr = preset.quickReplySlots[idx];
    oqr.contextMenu = [];
    await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(preset),
    });
    saveSettingsDebounced();
    await delay(400);
    applyQuickReplyPreset(selected_preset);
    return '';
}

async function qrPresetAddCallback(args, name) {
    const quickReplyPreset = {
        name: name,
        quickReplyEnabled: JSON.parse(args.enabled ?? null) ?? true,
        quickActionEnabled: JSON.parse(args.nosend ?? null) ?? false,
        placeBeforeInputEnabled: JSON.parse(args.before ?? null) ?? false,
        quickReplySlots: [],
        numberOfSlots: Number(args.slots ?? '0'),
        AutoInputInject: JSON.parse(args.inject ?? 'false'),
    };

    await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(quickReplyPreset),
    });
    await updateQuickReplyPresetList();
}

async function qrPresetUpdateCallback(args, name) {
    const preset = presets.find(it => it.name == name);
    const quickReplyPreset = {
        name: preset.name,
        quickReplyEnabled: JSON.parse(args.enabled ?? null) ?? preset.quickReplyEnabled,
        quickActionEnabled: JSON.parse(args.nosend ?? null) ?? preset.quickActionEnabled,
        placeBeforeInputEnabled: JSON.parse(args.before ?? null) ?? preset.placeBeforeInputEnabled,
        quickReplySlots: preset.quickReplySlots,
        numberOfSlots: Number(args.slots ?? preset.numberOfSlots),
        AutoInputInject: JSON.parse(args.inject ?? 'null') ?? preset.AutoInputInject,
    };
    Object.assign(preset, quickReplyPreset);

    await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(quickReplyPreset),
    });
}

let onMessageSentExecuting = false;
let onMessageReceivedExecuting = false;
let onChatChangedExecuting = false;

/**
 * Executes quick replies on message received.
 * @param {number} index New message index
 * @returns {Promise<void>}
 */
async function onMessageReceived(index) {
    if (!extension_settings.quickReply.quickReplyEnabled) return;

    if (onMessageReceivedExecuting) return;

    try {
        onMessageReceivedExecuting = true;
        for (let i = 0; i < extension_settings.quickReply.numberOfSlots; i++) {
            const qr = extension_settings.quickReply.quickReplySlots[i];
            if (qr?.autoExecute_botMessage) {
                const message = getContext().chat[index];
                if (message?.mes && message?.mes !== '...') {
                    await sendQuickReply(i);
                }
            }
        }
    } finally {
        onMessageReceivedExecuting = false;
    }
}

/**
 * Executes quick replies on message sent.
 * @param {number} index New message index
 * @returns {Promise<void>}
 */
async function onMessageSent(index) {
    if (!extension_settings.quickReply.quickReplyEnabled) return;

    if (onMessageSentExecuting) return;

    try {
        onMessageSentExecuting = true;
        for (let i = 0; i < extension_settings.quickReply.numberOfSlots; i++) {
            const qr = extension_settings.quickReply.quickReplySlots[i];
            if (qr?.autoExecute_userMessage) {
                const message = getContext().chat[index];
                if (message?.mes && message?.mes !== '...') {
                    await sendQuickReply(i);
                }
            }
        }
    } finally {
        onMessageSentExecuting = false;
    }
}

/**
 * Executes quick replies on chat changed.
 * @param {string} chatId New chat id
 * @returns {Promise<void>}
 */
async function onChatChanged(chatId) {
    if (!extension_settings.quickReply.quickReplyEnabled) return;

    if (onChatChangedExecuting) return;

    try {
        onChatChangedExecuting = true;
        for (let i = 0; i < extension_settings.quickReply.numberOfSlots; i++) {
            const qr = extension_settings.quickReply.quickReplySlots[i];
            if (qr?.autoExecute_chatLoad && chatId) {
                await sendQuickReply(i);
            }
        }
    } finally {
        onChatChangedExecuting = false;
    }
}

/**
 * Executes quick replies on app ready.
 * @returns {Promise<void>}
 */
async function onAppReady() {
    if (!extension_settings.quickReply.quickReplyEnabled) return;

    for (let i = 0; i < extension_settings.quickReply.numberOfSlots; i++) {
        const qr = extension_settings.quickReply.quickReplySlots[i];
        if (qr?.autoExecute_appStartup) {
            await sendQuickReply(i);
        }
    }
}

jQuery(async () => {
    moduleWorker();
    setInterval(moduleWorker, UPDATE_INTERVAL);
    const settingsHtml = `
    <div class="quickReplySettings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
            <b>Quick Reply</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div>
                <label class="checkbox_label">
                    <input id="quickReplyEnabled" type="checkbox" />
                    Enable Quick Replies
                </label>
                <label class="checkbox_label">
                    <input id="quickActionEnabled" type="checkbox" />
                    Disable Send / Insert In User Input
                </label>
                <label class="checkbox_label marginBot10">
                    <input id="placeBeforeInputEnabled" type="checkbox" />
                    Place Quick-reply before the Input
                </label>
                <label class="checkbox_label marginBot10">
                    <input id="AutoInputInject" type="checkbox" />
                    Inject user input automatically<br>(If disabled, use {{input}} macro for manual injection)
                </label>
                <label for="quickReplyPresets">Quick Reply presets:</label>
                <div class="flex-container flexnowrap wide100p">
                    <select id="quickReplyPresets" name="quickreply-preset" class="flex1 text_pole">
                    </select>
                    <div id="quickReplyPresetSaveButton" class="menu_button menu_button_icon">
                        <div class="fa-solid fa-save"></div>
                        <span>Save New</span>
                    </div>
                    <div id="quickReplyPresetUpdateButton" class="menu_button menu_button_icon">
                        <span>Update</span>
                    </div>
                </div>
                <label for="quickReplyNumberOfSlots">Number of slots:</label>
            </div>
            <div class="flex-container flexGap5 flexnowrap">
                <input id="quickReplyNumberOfSlots" class="text_pole" type="number" min="1" max="100" value="" />
                <div class="menu_button menu_button_icon" id="quickReplyNumberOfSlotsApply">
                    <div class="fa-solid fa-check"></div>
                    <span>Apply</span>
                </div>
            </div>
            <small><i>Customize your Quick Replies:</i></small><br>
            <div id="quickReplyContainer">
            </div>
        </div>
    </div>`;

    $('#extensions_settings2').append(settingsHtml);

    // Add event handler for quickActionEnabled
    $('#quickActionEnabled').on('input', onQuickActionEnabledInput);
    $('#placeBeforeInputEnabled').on('input', onPlaceBeforeInputEnabledInput);
    $('#AutoInputInject').on('input', onAutoInputInject);
    $('#quickReplyEnabled').on('input', onQuickReplyEnabledInput);
    $('#quickReplyNumberOfSlotsApply').on('click', onQuickReplyNumberOfSlotsInput);
    $('#quickReplyPresetSaveButton').on('click', saveQuickReplyPreset);
    $('#quickReplyPresetUpdateButton').on('click', updateQuickReplyPreset);

    $('#quickReplyContainer').sortable({
        delay: getSortableDelay(),
        stop: saveQROrder,
    });

    $('#quickReplyPresets').on('change', async function () {
        const quickReplyPresetSelected = $(this).find(':selected').val();
        extension_settings.quickReplyPreset = quickReplyPresetSelected;
        applyQuickReplyPreset(quickReplyPresetSelected);
        saveSettingsDebounced();
    });

    await loadSettings('init');
    addQuickReplyBar();

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onMessageReceived);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, onMessageSent);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.APP_READY, onAppReady);
});

jQuery(() => {
    registerSlashCommand('qr', doQR, [], '<span class="monospace">(number)</span> – activates the specified Quick Reply', true, true);
    registerSlashCommand('qrset', doQRPresetSwitch, [], '<span class="monospace">(name)</span> – swaps to the specified Quick Reply Preset', true, true);
    const qrArgs = `
    label    - string - text on the button, e.g., label=MyButton
    set      - string - name of the QR set, e.g., set=PresetName1
    hidden   - bool   - whether the button should be hidden, e.g., hidden=true
    startup  - bool   - auto execute on app startup, e.g., startup=true
    user     - bool   - auto execute on user message, e.g., user=true
    bot      - bool   - auto execute on AI message, e.g., bot=true
    load     - bool   - auto execute on chat load, e.g., load=true
    title    - bool   - title / tooltip to be shown on button, e.g., title="My Fancy Button"
    `.trim();
    const qrUpdateArgs = `
    newlabel - string - new text fort the button, e.g. newlabel=MyRenamedButton
    ${qrArgs}
    `.trim();
    registerSlashCommand('qr-create', qrCreateCallback, [], `<span class="monospace" style="white-space:pre-line;">(arguments [message])\n  arguments:\n    ${qrArgs}</span> – creates a new Quick Reply, example: <tt>/qr-create set=MyPreset label=MyButton /echo 123</tt>`, true, true);
    registerSlashCommand('qr-update', qrUpdateCallback, [], `<span class="monospace" style="white-space:pre-line;">(arguments [message])\n  arguments:\n    ${qrUpdateArgs}</span> – updates Quick Reply, example: <tt>/qr-update set=MyPreset label=MyButton newlabel=MyRenamedButton /echo 123</tt>`, true, true);
    registerSlashCommand('qr-delete', qrDeleteCallback, [], '<span class="monospace">(set=string [label])</span> – deletes Quick Reply', true, true);
    registerSlashCommand('qr-contextadd', qrContextAddCallback, [], '<span class="monospace">(set=string label=string chain=bool [preset name])</span> – add context menu preset to a QR, example: <tt>/qr-contextadd set=MyPreset label=MyButton chain=true MyOtherPreset</tt>', true, true);
    registerSlashCommand('qr-contextdel', qrContextDeleteCallback, [], '<span class="monospace">(set=string label=string [preset name])</span> – remove context menu preset from a QR, example: <tt>/qr-contextdel set=MyPreset label=MyButton MyOtherPreset</tt>', true, true);
    registerSlashCommand('qr-contextclear', qrContextClearCallback, [], '<span class="monospace">(set=string [label])</span> – remove all context menu presets from a QR, example: <tt>/qr-contextclear set=MyPreset MyButton</tt>', true, true);
    const presetArgs = `
    enabled - bool - enable or disable the preset
    nosend  - bool - disable send / insert in user input (invalid for slash commands)
    before  - bool - place QR before user input
    slots   - int  - number of slots
    inject  - bool - inject user input automatically (if disabled use {{input}})
    `.trim();
    registerSlashCommand('qr-presetadd', qrPresetAddCallback, [], `<span class="monospace" style="white-space:pre-line;">(arguments [label])\n  arguments:\n    ${presetArgs}</span> – create a new preset (overrides existing ones), example: <tt>/qr-presetadd slots=3 MyNewPreset</tt>`, true, true);
    registerSlashCommand('qr-presetupdate', qrPresetUpdateCallback, [], `<span class="monospace" style="white-space:pre-line;">(arguments [label])\n  arguments:\n    ${presetArgs}</span> – update an existing preset, example: <tt>/qr-presetupdate enabled=false MyPreset</tt>`, true, true);
});
