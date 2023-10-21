import { saveSettingsDebounced, callPopup, getRequestHeaders, substituteParams } from "../../../script.js";
import { getContext, extension_settings } from "../../extensions.js";
import { initScrollHeight, resetScrollHeight } from "../../utils.js";
import { registerSlashCommand } from "../../slash-commands.js";

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
}

//method from worldinfo
async function updateQuickReplyPresetList() {
    var result = await fetch("/getsettings", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (result.ok) {
        var data = await result.json();
        presets = data.quickReplyPresets?.length ? data.quickReplyPresets : [];
        console.debug('Quick Reply presets', presets);
        $("#quickReplyPresets").find('option[value!=""]').remove();


        if (presets !== undefined) {
            presets.forEach((item) => {
                const option = document.createElement('option');
                option.value = item.name;
                option.innerText = item.name;
                option.selected = selected_preset.includes(item.name);
                $("#quickReplyPresets").append(option);
            });
        }
    }
}

async function loadSettings(type) {
    if (type === 'init') {
        await updateQuickReplyPresetList()
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
    resetScrollHeight($(`#quickReply${id}Mes`));
    saveSettingsDebounced();
}

function onQuickReplyLabelInput(id) {
    extension_settings.quickReply.quickReplySlots[id - 1].label = $(`#quickReply${id}Label`).val();
    $(`#quickReply${id}`).text(String($(`#quickReply${id}Label`).val()));
    saveSettingsDebounced();
}

async function onQuickReplyEnabledInput() {
    let isEnabled = $(this).prop('checked')
    extension_settings.quickReply.quickReplyEnabled = !!isEnabled;
    if (isEnabled === true) {
        $("#quickReplyBar").show();
    } else { $("#quickReplyBar").hide(); }
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
    const existingText = $("#send_textarea").val();
    const prompt = extension_settings.quickReply.quickReplySlots[index]?.mes || '';

    if (!prompt) {
        console.warn(`Quick reply slot ${index} is empty! Aborting.`);
        return;
    }

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

    newText = substituteParams(newText);

    $("#send_textarea").val(newText);

    // Set the focus back to the textarea
    $("#send_textarea").trigger('focus');

    // Only trigger send button if quickActionEnabled is not checked or
    // the prompt starts with '/'
    if (!extension_settings.quickReply.quickActionEnabled || prompt.startsWith('/')) {
        $("#send_but").trigger('click');
    }
}


function addQuickReplyBar() {
    $('#quickReplyBar').remove();
    let quickReplyButtonHtml = '';

    for (let i = 0; i < extension_settings.quickReply.numberOfSlots; i++) {
        let quickReplyMes = extension_settings.quickReply.quickReplySlots[i]?.mes || '';
        let quickReplyLabel = extension_settings.quickReply.quickReplySlots[i]?.label || '';
        quickReplyButtonHtml += `<div title="${quickReplyMes}" class="quickReplyButton" data-index="${i}" id="quickReply${i + 1}">${quickReplyLabel}</div>`;
    }

    const quickReplyBarFullHtml = `
        <div id="quickReplyBar" class="flex-container flexGap5">
            <div id="quickReplies">
                ${quickReplyButtonHtml}
            </div>
        </div>
    `;

    $('#send_form').prepend(quickReplyBarFullHtml);

    $('.quickReplyButton').on('click', function () {
        let index = $(this).data('index');
        sendQuickReply(index);
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
        selectedPreset: name
    }

    const response = await fetch('/savequickreply', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(quickReplyPreset)
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
        toastr.warning('Failed to save Quick Reply Preset.')
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
        <div class="flex-container alignitemsflexstart">
            <input class="text_pole wide30p" id="quickReply${i}Label" placeholder="(Button label)">
            <textarea id="quickReply${i}Mes" placeholder="(Custom message or /command)" class="text_pole widthUnset flex1" rows="2"></textarea>
        </div>
        `;
    }

    $('#quickReplyContainer').empty().append(quickReplyHtml);

    for (let i = 1; i <= extension_settings.quickReply.numberOfSlots; i++) {
        $(`#quickReply${i}Mes`).on('input', function () { onQuickReplyInput(i); });
        $(`#quickReply${i}Label`).on('input', function () { onQuickReplyLabelInput(i); });
    }

    $('.quickReplySettings .inline-drawer-toggle').off('click').on('click', function () {
        for (let i = 1; i <= extension_settings.quickReply.numberOfSlots; i++) {
            initScrollHeight($(`#quickReply${i}Mes`));
        }
    });
}

async function applyQuickReplyPreset(name) {
    const quickReplyPreset = presets.find(x => x.name == name);

    if (!quickReplyPreset) {
        toastr.warning(`error, QR preset '${name}' not found. Confirm you are using proper case sensitivity!`)
        return;
    }

    extension_settings.quickReply = quickReplyPreset;
    extension_settings.quickReply.selectedPreset = name;
    saveSettingsDebounced()
    loadSettings('init')
    addQuickReplyBar();
    moduleWorker();

    $(`#quickReplyPresets option[value="${name}"]`).prop('selected', true);
    console.debug('QR Preset applied: ' + name);
}

async function doQRPresetSwitch(_, text) {
    text = String(text)
    applyQuickReplyPreset(text)
}

async function doQR(_, text) {
    if (!text) {
        toastr.warning('must specify which QR # to use')
        return
    }

    text = Number(text)
    //use scale starting with 0
    //ex: user inputs "/qr 2" >> qr with data-index 1 (but 2nd item displayed) gets triggered
    let QRnum = Number(text - 1)
    if (QRnum <= 0) { QRnum = 0 }
    const whichQR = $("#quickReplies").find(`[data-index='${QRnum}']`);
    whichQR.trigger('click')
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
                        <span>Save</span>
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
    $("#quickReplyPresetSaveButton").on('click', saveQuickReplyPreset);

    $("#quickReplyPresets").on('change', async function () {
        const quickReplyPresetSelected = $(this).find(':selected').val();
        extension_settings.quickReplyPreset = quickReplyPresetSelected;
        applyQuickReplyPreset(quickReplyPresetSelected);
        saveSettingsDebounced();
    });

    await loadSettings('init');
    addQuickReplyBar();
});

jQuery(() => {
    registerSlashCommand('qr', doQR, [], '<span class="monospace">(number)</span> – activates the specified Quick Reply', true, true);
    registerSlashCommand('qrset', doQRPresetSwitch, [], '<span class="monospace">(name)</span> – swaps to the specified Quick Reply Preset', true, true);
})
