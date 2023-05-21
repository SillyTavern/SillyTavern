import {
    callPopup,
} from '../script.js';

function openContextTemplateEditor() {
    const editor = $('#context_editor_template .context_editor').clone();
    $('#dialogue_popup').addClass('large_dialogue_popup wide_dialogue_popup');
    callPopup(editor.html(), 'text');
}

function copyTemplateParameter(event) {
    const text = $(event.target).text();
    navigator.clipboard.writeText(text);
    const copiedMsg = document.createElement("div");
    copiedMsg.classList.add('code-copied');
    copiedMsg.innerText = "Copied!";
    copiedMsg.style.top = `${event.clientY - 55}px`;
    copiedMsg.style.left = `${event.clientX - 55}px`;
    document.body.append(copiedMsg);
    setTimeout(() => {
        document.body.removeChild(copiedMsg);
    }, 1000);
}

jQuery(() => {
    $('#context_template_edit').on('click', openContextTemplateEditor);
    $(document).on('pointerup', '.template_parameters_list code', copyTemplateParameter);
})