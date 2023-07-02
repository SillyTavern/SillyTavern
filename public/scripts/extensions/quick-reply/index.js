import { saveSettingsDebounced } from "../../../script.js";
import { getContext, extension_settings } from "../../extensions.js";
import { initScrollHeight, resetScrollHeight } from "../../utils.js";

export { MODULE_NAME };

const MODULE_NAME = 'quick-reply';
const UPDATE_INTERVAL = 1000;

const defaultSettings = {
    quickReplyEnabled: false,
    numberOfSlots: 5,
    quickReplySlots: [],
}

async function loadSettings() {
    if (Object.keys(extension_settings.quickReply).length === 0) {
        Object.assign(extension_settings.quickReply, defaultSettings);
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

    generateQuickReplyElements();

    for (let i = 1; i <= extension_settings.quickReply.numberOfSlots; i++) {
        $(`#quickReply${i}Mes`).val(extension_settings.quickReply.quickReplySlots[i - 1]?.mes).trigger('input');
        $(`#quickReply${i}Label`).val(extension_settings.quickReply.quickReplySlots[i - 1]?.label).trigger('input');
    }

    $('#quickReplyEnabled').prop('checked', extension_settings.quickReply.quickReplyEnabled);
    $('#quickReplyNumberOfSlots').val(extension_settings.quickReply.numberOfSlots);
}

function onQuickReplyInput(id) {
    extension_settings.quickReply.quickReplySlots[id - 1].mes = $(`#quickReply${id}Mes`).val();
    $(`#quickReply${id}`).attr('title', ($(`#quickReply${id}Mes`).val()));
    resetScrollHeight($(`#quickReply${id}Mes`));
    saveSettingsDebounced();
}

function onQuickReplyLabelInput(id) {
    extension_settings.quickReply.quickReplySlots[id - 1].label = $(`#quickReply${id}Label`).val();
    $(`#quickReply${id}`).text($(`#quickReply${id}Label`).val());
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

async function sendQuickReply(id) {
    var prompt = extension_settings.quickReply[`${id}Mes`];
    $("#send_textarea").val(prompt);
    $("#send_but").trigger('click');
}

function addQuickReplyBar() {
    $('#quickReplyBar').remove();
    let quickReplyButtonHtml = '';

    for (let i = 0; i < extension_settings.quickReply.numberOfSlots; i++) {
        let quickReplyMes = extension_settings.quickReply.quickReplySlots[i]?.mes || '';
        let quickReplyLabel = extension_settings.quickReply.quickReplySlots[i]?.label || '';
        quickReplyButtonHtml += `<div title="${quickReplyMes}" class="quickReplyButton" id="quickReply${i + 1}">${quickReplyLabel}</div>`;
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
        let quickReplyButtonID = $(this).attr('id');
        sendQuickReply(quickReplyButtonID);
    });
}

async function moduleWorker() {
    if (extension_settings.quickReply.quickReplyEnabled === true) {
        $('#quickReplyBar').toggle(getContext().onlineStatus !== 'no_connection');
    }
}

async function onQuickReplyNumberOfSlotsInput() {
    let numberOfSlots = Number($(this).val());

    if (isNaN(numberOfSlots)) {
        numberOfSlots = defaultSettings.numberOfSlots;
    }

    // Clamp min and max values (from input attributes)
    if (numberOfSlots < Number($(this).attr('min'))) {
        numberOfSlots = Number($(this).attr('min'));
    } else if (numberOfSlots > Number($(this).attr('max'))) {
        numberOfSlots = Number($(this).attr('max'));
    }

    extension_settings.quickReply.numberOfSlots = numberOfSlots;
    extension_settings.quickReply.quickReplySlots.length = numberOfSlots;

    // Initialize new slots
    for (let i = 0; i < numberOfSlots; i++) {
        if (!extension_settings.quickReply.quickReplySlots[i]) {
            extension_settings.quickReply.quickReplySlots[i] = {
                mes: '',
                label: '',
                enabled: true,
            };
        }
    }

    await loadSettings();
    addQuickReplyBar();
    moduleWorker();
    saveSettingsDebounced();
}

function generateQuickReplyElements() {
    let quickReplyHtml = '';

    for (let i = 1; i <= extension_settings.quickReply.numberOfSlots; i++) {
        quickReplyHtml += `
        <div class="flex-container alignitemsflexstart">
            <input class="text_pole wide30p" id="quickReply${i}Label" placeholder="(Add a button label)">
            <textarea id="quickReply${i}Mes" placeholder="(custom message here)" class="text_pole widthUnset flex1" rows="2"></textarea>
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
            <label class="checkbox_label">
                <input id="quickReplyEnabled" type="checkbox" />
                    Enable Quick Replies
            </label>
            <label for="quickReplyNumberOfSlots">Number of slots:</label>
            <input id="quickReplyNumberOfSlots" class="text_pole" type="number" min="1" max="100" value="" />
            <small><i>Customize your Quick Replies:</i></small><br>
            <div id="quickReplyContainer">
            </div>
        </div>
    </div>`;

    $('#extensions_settings2').append(settingsHtml);

    $('#quickReplyEnabled').on('input', onQuickReplyEnabledInput);
    $('#quickReplyNumberOfSlots').on('input', onQuickReplyNumberOfSlotsInput);

    await loadSettings();
    addQuickReplyBar();
});

