import { callPopup, main_api } from "../../../script.js";
import { getContext } from "../../extensions.js";
import { registerSlashCommand } from "../../slash-commands.js";
import { getTokenCount, getTokenizerModel } from "../../tokenizers.js";

async function doTokenCounter() {
    const selectedTokenizer = main_api == 'openai'
        ? `tiktoken (${getTokenizerModel()})`
        : $("#tokenizer").find(':selected').text();
    const html = `
    <div class="wide100p">
        <h3>Token Counter</h3>
        <div class="justifyLeft">
            <h4>Type / paste in the box below to see the number of tokens in the text.</h4>
            <p>Selected tokenizer: ${selectedTokenizer}</p>
            <textarea id="token_counter_textarea" class="wide100p textarea_compact margin-bot-10px" rows="20"></textarea>
            <div>Tokens: <span id="token_counter_result">0</span></div>
        </div>
    </div>`;

    const dialog = $(html);
    dialog.find('#token_counter_textarea').on('input', () => {
        const text = $('#token_counter_textarea').val();
        const context = getContext();
        const count = context.getTokenCount(text);
        $('#token_counter_result').text(count);
    });

    $('#dialogue_popup').addClass('wide_dialogue_popup');
    callPopup(dialog, 'text');
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
