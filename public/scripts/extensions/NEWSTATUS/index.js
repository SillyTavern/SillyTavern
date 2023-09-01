import { saveSettingsDebounced } from "../../../script.js";
import { getContext, extension_settings } from "../../extensions.js";
import { initScrollHeight, debounce, resetScrollHeight } from "../../utils.js";
import { eventSource, event_types} from "../../../script.js";
// 导入事件源、事件类型、扩展提示类型等函数和变量
export { MODULE_NAME };
let matchedStatus = '';
const MODULE_NAME = 'deal-status';
const DealNum = 5;         //最多处理多少条信息
const defaultSettings = {
    dealStatusEnabled: false,
    numberOfSlots: 3,
    dealStatusSlots: [],
};
const saveChatDebounced = debounce(() => getContext().saveChat(), 2000);
async function loadSettings() {
    if (!extension_settings.dealStatus) {
        extension_settings.dealStatus = { ...defaultSettings };
    }

    if (!Array.isArray(extension_settings.dealStatus.dealStatusSlots)) {
        extension_settings.dealStatus.dealStatusSlots = [];
        extension_settings.dealStatus.numberOfSlots = defaultSettings.numberOfSlots;

        for (let i = 1; i <= extension_settings.dealStatus.numberOfSlots; i++) {
            const mes = extension_settings.dealStatus[`dealStatus${i}Mes`] || '';
            const DelNum = extension_settings.dealStatus[`dealStatus${i}DelNum`] || '';

            extension_settings.dealStatus.dealStatusSlots.push({
                mes,
                DelNum,
                enabled: true,
            });

            delete extension_settings.dealStatus[`dealStatus${i}Mes`];
            delete extension_settings.dealStatus[`dealStatus${i}DelNum`];
        }
    }

    const numberOfSlots = extension_settings.dealStatus.numberOfSlots || defaultSettings.numberOfSlots;

    initializeEmptySlots(numberOfSlots);
    generateDealStatusElements();

    for (let i = 1; i <= numberOfSlots; i++) {
        const dealStatusSlot = extension_settings.dealStatus.dealStatusSlots[i - 1] || {};
        $(`#dealStatus${i}Mes`).val(dealStatusSlot.mes || '').trigger('input');
        $(`#dealStatus${i}DelNum`).val(dealStatusSlot.DelNum || '').trigger('input');
    }

    $('#dealStatusEnabled').prop('checked', !!extension_settings.dealStatus.dealStatusEnabled);
    $('#dealStatusNumberOfSlots').val(numberOfSlots);
}

function onDealStatusInput(id) {
    extension_settings.dealStatus.dealStatusSlots[id - 1].mes = $(`#dealStatus${id}Mes`).val();
    $(`#dealStatus${id}`).attr('title', ($(`#dealStatus${id}Mes`).val()));
    resetScrollHeight($(`#dealStatus${id}Mes`));
    saveSettingsDebounced();
}

function onDealStatusDelNumInput(id) {
    extension_settings.dealStatus.dealStatusSlots[id - 1].DelNum = $(`#dealStatus${id}DelNum`).val();
    $(`#dealStatus${id}`).text($(`#dealStatus${id}DelNum`).val());
    saveSettingsDebounced();
}

async function onDealStatusEnabledInput() {
    let isEnabled = $(this).prop('checked');
    extension_settings.dealStatus.dealStatusEnabled = !!isEnabled;
    saveSettingsDebounced();
}

async function onDealStatusNumberOfSlotsInput() {
    const $input = $('#dealStatusNumberOfSlots');
    let numberOfSlots = Number($input.val());

    if (isNaN(numberOfSlots)) {
        numberOfSlots = defaultSettings.numberOfSlots;
    }

    if (numberOfSlots < Number($input.attr('min'))) {
        numberOfSlots = Number($input.attr('min'));
    } else if (numberOfSlots > Number($input.attr('max'))) {
        numberOfSlots = Number($input.attr('max'));
    }

    extension_settings.dealStatus.numberOfSlots = numberOfSlots;
    extension_settings.dealStatus.dealStatusSlots.length = numberOfSlots;

    initializeEmptySlots(numberOfSlots);

    await loadSettings();

    saveSettingsDebounced();
    onChatEvent();
}

function initializeEmptySlots(numberOfSlots) {
    for (let i = 0; i < numberOfSlots; i++) {
        if (!extension_settings.dealStatus.dealStatusSlots[i]) {
            extension_settings.dealStatus.dealStatusSlots[i] = {
                mes: '',
                DelNum: '',
                enabled: true,
            };
        }
    }
}

async function onChatEvent() {
    if (!extension_settings.dealStatus.dealStatusEnabled) {
        return;
    }
  
    const chat = getContext().chat;
    // const chat = context.chat;
    const $input = $('#dealStatusNumberOfSlots');
    let numberOfSlots = Number($input.val());
    const dealStatusSlot = extension_settings.dealStatus.dealStatusSlots
    const ReNum = [];
    const ReMes = [];
    const DelTime = [];
    const DelTime2 = [];
    const len = chat.length;
    if (len < 5)                                    //聊天长度少于5则不执行任何操作直接返回    
        return;
    for (let i = 0; i < numberOfSlots; i++) {
        let DelNum = parseFloat(dealStatusSlot[i].DelNum);
        if (isNaN(DelNum)) {
            DelNum = 0;
        }
        const mes = dealStatusSlot[i].mes;
        ReNum[i] = DelNum;                      //保留几次匹配
        ReMes[i] = mes;
        DelTime[i] = 0;
        DelTime2[i] = 0;
    }

    let count = 0;                              //只追踪50条信息
    let allStr = '';                            //获取最新的所有匹配
    for (let i = len - 1; i > 0 && count < 50; i--) {
        count++;
        // allStr = '';
        if(!chat[i].is_user)     //不处理用户的信息
        {
            for(let j = 0; j < numberOfSlots; j++)
            {
                if(ReNum[j] < 2)                            //保留条数低于2认为是禁用处理
                    continue;
                if(DelTime2[j] >= DealNum)                   //匹配完最近消息后只往前最多匹配10条ai回复的消息
                    continue;
                if(DelTime[j] > ReNum[j])
                    DelTime2[j]++;
                const regex = new RegExp(ReMes[j]);
                const matches = regex.exec(chat[i].mes);
                const str2 = matches != null ? matches[0] : ''; 
                if(str2)                                          //如果str2可以匹配到内容
                {
                    DelTime[j]++;
                    if(DelTime[j] === 1)
                        allStr = allStr + str2;                   
                    if(DelTime[j] <= ReNum[j])                    //对前ReNum[j]次匹配不做处理
                        continue;
                    chat[i].mes = chat[i].mes.replace(regex, ''); // 去掉匹配部分
                }
            }
        }
    }
    // 更新匹配到的状态
    matchedStatus = allStr;

    // 显示匹配到的状态在界面上
    $('#matchedStatusContainer').text(matchedStatus);
    saveChatDebounced();
}



function generateDealStatusElements() {
    let dealStatusHtml = '';
  
    for (let i = 1; i <= extension_settings.dealStatus.numberOfSlots; i++) {
      dealStatusHtml += `
        <div class="flex-container alignitemsflexstart">
            <input class="text_pole wide30p" id="dealStatus${i}DelNum" placeholder="保留状态数">
            <textarea id="dealStatus${i}Mes" placeholder="状态正则匹配式" class="text_pole widthUnset flex1" rows="2"></textarea>
        </div>
      `;
    }
  
    const dealStatusContainerHtml = `
      <small><i>匹配到的状态如下:</i></small><br>
      <div id="matchedStatusContainer"></div>
    `;
  
    $('#dealStatusContainer').empty().append(dealStatusHtml, dealStatusContainerHtml);
  
    for (let i = 1; i <= extension_settings.dealStatus.numberOfSlots; i++) {
      $(`#dealStatus${i}Mes`).on('input', function () { onDealStatusInput(i); });
      $(`#dealStatus${i}DelNum`).on('input', function () { onDealStatusDelNumInput(i); });
    }
  
    $('.dealStatusSettings .inline-drawer-toggle').off('click').on('click', function () {
      for (let i = 1; i <= extension_settings.dealStatus.numberOfSlots; i++) {
        initScrollHeight($(`#dealStatus${i}Mes`));
      }
    });
  }  

jQuery(async () => {
    const settingsHtml = `
        <div class="dealStatusSettings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                <b>Deal Status</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label marginBot10">
                    <input id="dealStatusEnabled" type="checkbox" />
                        Enable Deal Status
                </label>
                <label for="dealStatusNumberOfSlots">Number of slots:</label>
                <div class="flex-container flexGap5 flexnowrap">
                    <input id="dealStatusNumberOfSlots" class="text_pole" type="number" min="1" max="20" value="" />
                    <div class="menu_button menu_button_icon" id="dealStatusNumberOfSlotsApply">
                        <div class="fa-solid fa-check"></div>
                        <span>Apply</span>
                    </div>
                </div>
                <small><i>状态处理，第一个框内填入目标状态保留条数（至少为2，小于2时认为为禁用），第二框内填入目标状态的正则匹配</i></small><br>
                <div id="dealStatusContainer">
                </div>
            </div>
        </div>`;

    $('#extensions_settings2').append(settingsHtml);

    $('#dealStatusEnabled').on('input', onDealStatusEnabledInput);
    $('#dealStatusNumberOfSlotsApply').on('click', onDealStatusNumberOfSlotsInput);

    await loadSettings();
    eventSource.on(event_types.MESSAGE_RECEIVED, onChatEvent);
    // eventSource.on(event_types.MESSAGE_DELETED, onChatEvent);
    // eventSource.on(event_types.MESSAGE_EDITED, onChatEvent);
    // eventSource.on(event_types.MESSAGE_SWIPED, onChatEvent);
    // eventSource.on(event_types.CHAT_CHANGED, onChatEvent);
});
