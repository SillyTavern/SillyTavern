import { callPopup, main_api } from "../../../script.js";
import { getContext } from "../../extensions.js";
import { registerSlashCommand } from "../../slash-commands.js";
import { getFriendlyTokenizerName, getTextTokens, getTokenCount, tokenizers } from "../../tokenizers.js";
import { resetScrollHeight } from "../../utils.js";

function rgb2hex(rgb) {
    rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
    return (rgb && rgb.length === 4) ? "#" +
        ("0" + parseInt(rgb[1], 10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[2], 10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[3], 10).toString(16)).slice(-2) : '';
}

$('button').click(function () {
    var hex = rgb2hex($('input').val());
    $('.result').html(hex);
});

async function doTokenCounter() {
    const { tokenizerName, tokenizerId } = getFriendlyTokenizerName(main_api);
    const html = `
    <div class="wide100p">
        <h3>Token Counter</h3>
        <div class="justifyLeft flex-container flexFlowColumn">
            <h4>Type / paste in the box below to see the number of tokens in the text.</h4>
            <p>Selected tokenizer: ${tokenizerName}</p>
            <div>Input:</div>
            <textarea id="token_counter_textarea" class="wide100p textarea_compact" rows="1"></textarea>
            <div>Tokens: <span id="token_counter_result">0</span></div>
            <hr>
            <div>Tokenized text:</div>
            <div id="tokenized_chunks_display" class="wide100p">—</div>
            <hr>
            <div>Token IDs:</div>
            <textarea id="token_counter_ids" class="wide100p textarea_compact" disabled rows="1">—</textarea>
        </div>
    </div>`;

    const dialog = $(html);
    dialog.find('#token_counter_textarea').on('input', () => {
        const text = String($('#token_counter_textarea').val());
        const ids = main_api == 'openai' ? getTextTokens(tokenizers.OPENAI, text) : getTextTokens(tokenizerId, text);

        if (Array.isArray(ids) && ids.length > 0) {
            $('#token_counter_ids').text(`[${ids.join(', ')}]`);
            $('#token_counter_result').text(ids.length);

            if (Object.hasOwnProperty.call(ids, 'chunks')) {
                drawChunks(Object.getOwnPropertyDescriptor(ids, 'chunks').value, ids);
            }
        } else {
            const context = getContext();
            const count = context.getTokenCount(text);
            $('#token_counter_ids').text('—');
            $('#token_counter_result').text(count);
            $('#tokenized_chunks_display').text('—');
        }

        resetScrollHeight($('#token_counter_textarea'));
        resetScrollHeight($('#token_counter_ids'));
    });

    $('#dialogue_popup').addClass('wide_dialogue_popup');
    callPopup(dialog, 'text', '', { wide: true, large: true });
}

/**
 * Draws the tokenized chunks in the UI
 * @param {string[]} chunks
 * @param {number[]} ids
 */
function drawChunks(chunks, ids) {
    const main_text_color = rgb2hex((getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBodyColor').trim()))
    const italics_text_color = rgb2hex((getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeEmColor').trim()))
    const quote_text_color = rgb2hex((getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim()))
    const blur_tint_color = rgb2hex((getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBlurTintColor').trim()))
    const chat_tint_color = rgb2hex((getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeChatTintColor').trim()))
    const user_mes_blur_tint_color = rgb2hex((getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeUserMesBlurTintColor').trim()))
    const bot_mes_blur_tint_color = rgb2hex((getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBotMesBlurTintColor').trim()))
    const shadow_color = rgb2hex((getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeShadowColor').trim()))
    const border_color = rgb2hex((getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBorderColor').trim()))

    const pastelRainbow = [
        //main_text_color,
        //italics_text_color,
        //quote_text_color,
        '#FFB3BA',
        '#FFDFBA',
        '#FFFFBA',
        '#BFFFBF',
        '#BAE1FF',
        '#FFBAF3',
    ];
    $('#tokenized_chunks_display').empty();

    for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i].replace(/▁/g, ' '); // This is a leading space in sentencepiece. More info: Lower one eighth block (U+2581)

        // If <0xHEX>, decode it
        if (/^<0x[0-9A-F]+>$/i.test(chunk)) {
            const code = parseInt(chunk.substring(3, chunk.length - 1), 16);
            chunk = String.fromCodePoint(code);
        }

        // If newline - insert a line break
        if (chunk === '\n') {
            $('#tokenized_chunks_display').append('<br>');
            continue;
        }

        const color = pastelRainbow[i % pastelRainbow.length];
        const chunkHtml = $(`<code style="background-color: ${color};">${chunk}</code>`);
        chunkHtml.attr('title', ids[i]);
        $('#tokenized_chunks_display').append(chunkHtml);
    }
}

function doCount() {
    // get all of the messages in the chat
    const context = getContext();
    const messages = context.chat.filter(x => x.mes && !x.is_system).map(x => x.mes);

    //concat all the messages into a single string
    const allMessages = messages.join(' ');

    console.debug('All messages:', allMessages);

    //toastr success with the token count of the chat
    toastr.success(`Token count: ${getTokenCount(allMessages)}`);
}

jQuery(() => {
    const buttonHtml = `
        <div id="token_counter" class="list-group-item flex-container flexGap5">
            <div class="fa-solid fa-1 extensionsMenuExtensionButton" /></div>
            Token Counter
        </div>`;
    $('#extensionsMenu').prepend(buttonHtml);
    $('#token_counter').on('click', doTokenCounter);
    registerSlashCommand('count', doCount, [], '– counts the number of tokens in the current chat', true, false);
});
