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
    toastr.info('Copied!', '', { timeOut: 2000 });
}

jQuery(() => {
    $('#context_template_edit').on('click', openContextTemplateEditor);
    $(document).on('pointerup', '.template_parameters_list code', copyTemplateParameter);
})