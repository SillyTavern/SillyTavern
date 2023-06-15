import { saveSettingsDebounced } from "../../../script.js";
import { getContext, extension_settings } from "../../extensions.js";
import { initScrollHeight, resetScrollHeight } from "../../utils.js";

export { MODULE_NAME };

const MODULE_NAME = 'quick-reply';
const UPDATE_INTERVAL = 1000;

const defaultSettings = {
    quickReply1Mes: '',
    quickReply1Label: '',
    quickReply2Mes: '',
    quickReply2Label: '',
    quickReply3Mes: '',
    quickReply3Label: '',
    quickReply4Mes: '',
    quickReply4Label: '',
    quickReply5Mes: '',
    quickReply5Label: '',
    quickReplyEnabled: false,
}

async function loadSettings() {
    if (Object.keys(extension_settings.quickReply).length === 0) {
        Object.assign(extension_settings.quickReply, defaultSettings);
    }

    $('#quickReplyEnabled').prop('checked', extension_settings.quickReply.quickReplyEnabled);

    $('#quickReply1Mes').val(extension_settings.quickReply.quickReply1Mes).trigger('input');
    $('#quickReply1Label').val(extension_settings.quickReply.quickReply1Label).trigger('input');

    $('#quickReply2Mes').val(extension_settings.quickReply.quickReply2Mes).trigger('input');
    $('#quickReply2Label').val(extension_settings.quickReply.quickReply2Label).trigger('input');

    $('#quickReply3Mes').val(extension_settings.quickReply.quickReply3Mes).trigger('input');
    $('#quickReply3Label').val(extension_settings.quickReply.quickReply3Label).trigger('input');

    $('#quickReply4Mes').val(extension_settings.quickReply.quickReply4Mes).trigger('input');
    $('#quickReply4Label').val(extension_settings.quickReply.quickReply4Label).trigger('input');

    $('#quickReply5Mes').val(extension_settings.quickReply.quickReply5Mes).trigger('input');
    $('#quickReply5Label').val(extension_settings.quickReply.quickReply5Label).trigger('input');
}

function onQuickReplyInput(id) {
    extension_settings.quickReply[`quickReply${id}Mes`] = $(`#quickReply${id}Mes`).val();
    $(`#quickReply${id}`).attr('title', ($(`#quickReply${id}Mes`).val()));
    resetScrollHeight($(`#quickReply${id}Mes`));
    saveSettingsDebounced();
}

function onQuickReplyLabelInput(id) {
    extension_settings.quickReply[`quickReply${id}Label`] = $(`#quickReply${id}Label`).val();
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

function addQuickReplyBar(numButtons) {
    var numButtons = 5;
    const quickReplyBarStartHtml = `
    <div id="quickReplyBar" class="flex-container flexGap5">
        <div id="quickReplies">
        `;
    let quickReplyButtonHtml = '';
    for (let i = 0; i < numButtons; i++) {
        let quickReplyMes = extension_settings.quickReply[`quickReply${i + 1}Mes`];
        let quickReplyLabel = extension_settings.quickReply[`quickReply${i + 1}Label`];
        //console.log(quickReplyMes);
        quickReplyButtonHtml += `<div title="${quickReplyMes}" class="quickReplyButton" id="quickReply${i + 1}">${quickReplyLabel}</div>`;
    }
    const quickReplyEndHtml = `</div></div>`
    const quickReplyBarFullHtml = [quickReplyBarStartHtml, quickReplyButtonHtml, quickReplyEndHtml].join('');

    $('#send_form').prepend(quickReplyBarFullHtml);

    $('.quickReplyButton').on('click', function () {
        console.log('got quick reply click');
        let quickReplyButtonID = $(this).attr('id');
        sendQuickReply(quickReplyButtonID);
    });
}


async function moduleWorker() {
    if (extension_settings.quickReply.quickReplyEnabled === true) {
        $('#quickReplyBar').toggle(getContext().onlineStatus !== 'no_connection');
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
            <label class="checkbox_label">
                <input id="quickReplyEnabled" type="checkbox" />
                    Enable Quick Replies
            </label>
            <small><i>Customize your Quick Replies:</i></small><br>
            <div class="flex-container alignitemsflexstart">
                <input class="text_pole wide30p" id="quickReply1Label" placeholder="(Add a button label)">
                <textarea id="quickReply1Mes" placeholder="(custom message here)" class="text_pole textarea_compact widthUnset flex1" rows="2"></textarea>
            </div>
            <div class="flex-container alignitemsflexstart">
                <input class="text_pole wide30p" id="quickReply2Label" placeholder="(Add a button label)">
                <textarea id="quickReply2Mes"  placeholder="(custom message here)" class="text_pole textarea_compact widthUnset flex1" rows="2"></textarea>
            </div>
            <div class="flex-container alignitemsflexstart">
                <input class="text_pole wide30p" id="quickReply3Label" placeholder="(Add a button label)">
                <textarea id="quickReply3Mes"  placeholder="(custom message here)" class="text_pole textarea_compact widthUnset flex1" rows="2"></textarea>
            </div>
            <div class="flex-container alignitemsflexstart">
                <input class="text_pole wide30p" id="quickReply4Label" placeholder="(Add a button label)">
                <textarea id="quickReply4Mes"  placeholder="(custom message here)" class="text_pole textarea_compact widthUnset flex1" rows="2"></textarea>
            </div>
            <div class="flex-container alignitemsflexstart">
                <input class="text_pole wide30p" id="quickReply5Label" placeholder="(Add a button label)">
                <textarea id="quickReply5Mes"  placeholder="(custom message here)" class="text_pole textarea_compact widthUnset flex1" rows="2"></textarea>
            </div>
        </div>
    </div>`;

    $('#extensions_settings2').append(settingsHtml);

    $('#quickReply1Mes').on('input', function () { onQuickReplyInput(1); });
    $('#quickReply2Mes').on('input', function () { onQuickReplyInput(2); });
    $('#quickReply3Mes').on('input', function () { onQuickReplyInput(3); });
    $('#quickReply4Mes').on('input', function () { onQuickReplyInput(4); });
    $('#quickReply5Mes').on('input', function () { onQuickReplyInput(5); });

    $('#quickReply1Label').on('input', function () { onQuickReplyLabelInput(1); });
    $('#quickReply2Label').on('input', function () { onQuickReplyLabelInput(2); });
    $('#quickReply3Label').on('input', function () { onQuickReplyLabelInput(3); });
    $('#quickReply4Label').on('input', function () { onQuickReplyLabelInput(4); });
    $('#quickReply5Label').on('input', function () { onQuickReplyLabelInput(5); });

    $('#quickReplyEnabled').on('input', onQuickReplyEnabledInput);

    $('.quickReplySettings .inline-drawer-toggle').on('click', function () {
        initScrollHeight($("#quickReply1Mes"));
        initScrollHeight($("#quickReply2Mes"));
        initScrollHeight($("#quickReply3Mes"));
        initScrollHeight($("#quickReply4Mes"));
        initScrollHeight($("#quickReply5Mes"));
    })

    await loadSettings();
    addQuickReplyBar();
});

