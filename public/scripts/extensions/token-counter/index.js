import { callPopup, main_api } from "../../../script.js";
import { getContext } from "../../extensions.js";
import { registerSlashCommand } from "../../slash-commands.js";
import { getTextTokens, getTokenCount, getTokenizerBestMatch, getTokenizerModel, tokenizers } from "../../tokenizers.js";

async function doTokenCounter() {
    const tokenizerOption = $("#tokenizer").find(':selected');
    let tokenizerId = Number(tokenizerOption.val());
    let tokenizerName = tokenizerOption.text();

    if (main_api !== 'openai' && tokenizerId === tokenizers.BEST_MATCH) {
        tokenizerId = getTokenizerBestMatch();
        tokenizerName = $(`#tokenizer option[value="${tokenizerId}"]`).text();
    }

    const selectedTokenizer = main_api == 'openai'
        ? getTokenizerModel()
        : tokenizerName;
    const html = `
    <div class="wide100p">
        <h3>Token Counter</h3>
        <div class="justifyLeft">
            <h4>Type / paste in the box below to see the number of tokens in the text.</h4>
            <p>Selected tokenizer: ${selectedTokenizer}</p>
            <textarea id="token_counter_textarea" class="wide100p textarea_compact margin-bot-10px" rows="15"></textarea>
            <div>Tokens: <span id="token_counter_result">0</span></div>
            <br>
            <div>Token IDs (if applicable):</div>
            <textarea id="token_counter_ids" disabled rows="10"></textarea>
        </div>
    </div>`;

    const dialog = $(html);
    dialog.find('#token_counter_textarea').on('input', () => {
        const text = String($('#token_counter_textarea').val());
        const ids = main_api == 'openai' ? getTextTokens(tokenizers.OPENAI, text) : getTextTokens(tokenizerId, text);

        if (Array.isArray(ids) && ids.length > 0) {
            $('#token_counter_ids').text(JSON.stringify(ids));
            $('#token_counter_result').text(ids.length);
        } else {
            const context = getContext();
            const count = context.getTokenCount(text);
            $('#token_counter_ids').text('—');
            $('#token_counter_result').text(count);
        }
    });

    $('#dialogue_popup').addClass('wide_dialogue_popup');
    callPopup(dialog, 'text', '', { wide: true, large: true });
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
