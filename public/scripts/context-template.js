import {
    callPopup,
    getRequestHeaders,
    saveSettingsDebounced,
} from '../script.js';
import { debounce } from './utils.js';

export let context_templates = [];
export let context_settings = {
    selected_template: '',
};

const saveTemplateDebounced = debounce((name) => alert('implement me', name), 2000);

export function loadContextTemplatesFromSettings(data, settings) {
    context_templates = data.context || [];
    context_settings = Object.assign(context_settings, (settings.context_settings || {}));

    const dropdown = $('#context_template');
    dropdown.empty();
    dropdown.append('<option value="">-- None --</option>')

    for (const template of context_templates) {
        const name = template.name;
        const option = document.createElement('option');
        option.innerText = name;
        option.value = name;
        option.selected = context_settings.selected_template == name;
        dropdown.append(option);
    }
}

function onContextTemplateChange() {
    const value = $(this).find(':selected').val();
    context_settings.selected_template = value;
    saveSettingsDebounced();
}

function openContextTemplateEditor() {
    const template = context_templates.find(x => x.name == context_settings.selected_template);

    if (!template || !context_settings.selected_template) {
        toastr.info('No context template selected');
        return;
    }

    const editor = $('#context_editor_template .context_editor').clone();
    const injectionsContainer = editor.find('.chat_injections_list');
    editor.find('.template_name').text(template.name);
    editor.find('.story_string_template').text(template.storyString).on('input', function () {
        const value = $(this).val();
        template.storyString = value;
        saveTemplateDebounced(template.name);
    });
    editor.find('.chat_injection_add').on('click', function () {
        const injection = { id: Date.now(), text: '', depth: 0 };
        template.injections.push(injection);
        addChatInjection(injectionsContainer, injection, template);
        saveTemplateDebounced(template.name);
    });

    for (const injection of template.injections) {
        addChatInjection(injectionsContainer, injection, template);
    }

    $('#dialogue_popup').addClass('large_dialogue_popup wide_dialogue_popup');
    callPopup(editor, 'text');
}

async function onRenameContextTemplateClick() {
    const oldName = context_settings.selected_template;
    const newName = await inputTemplateName();
    const template = context_templates.find(x => x.name === oldName);

    if (!template || !newName || oldName === newName) {
        return;
    }

    await saveContextTemplate(newName);
    context_settings.selected_template = newName;
    saveSettingsDebounced();
    await deleteContextTemplate(oldName);
    toastr.success('Context template renamed', newName);
}

async function deleteContextTemplate(name) {
    const response = await fetch('/delete_context_template', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name }),
    });

    if (!response.ok) {
        throw new Error('Context template not deleted');
    }
}

async function saveContextTemplate(name) {
    const template = context_templates.find(x => x.name === name);

    if (!template) {
        throw new Error(`Context template not found: ${name}`);
    }

    const response = await fetch('/save_context_template', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name, template }),
    });

    if (!response.ok) {
        throw new Error('Context template not saved');
    }
}

async function inputTemplateName() {
    let name = await callPopup('Enter a template name:', 'input');

    if (!name) {
        return false;
    }

    name = DOMPurify.sanitize(name.trim());

    if (context_templates.findIndex(x => x.name == name) > -1) {
        toastr.warning('Template with that name already exists', 'Pick a unique name');
        return false;
    }

    return name;
}

function addChatInjection(container, model, parent) {
    const template = $('#chat_injection_template .chat_injection').clone();
    template.attr('id', model.id);
    template.find('.chat_injection_text').val(model.text).on('input', function () {
        const value = $(this).val();
        model.text = value;
        saveTemplateDebounced(parent.name);
    });
    template.find('.chat_injection_depth').val(model.depth).on('input', function () {
        const value = Math.abs(Number($(this).val()));
        model.depth = value;
        saveTemplateDebounced(parent.name);
    });
    template.find('.chat_injection_remove').on('click', function () {
        if (!confirm('Are you sure?')) {
            return;
        }

        const index = parent.injections.findIndex(x => x == model);

        if (index === -1) {
            console.error('Does not compute, injection index was lost');
            return;
        }

        parent.injections.splice(index, 1);
        template.remove();
        saveTemplateDebounced(parent.name);
    });
    container.append(template);
}

function copyTemplateParameter(event) {
    const text = $(event.target).text();
    navigator.clipboard.writeText(text);
    toastr.info('Copied!', '', { timeOut: 2000 });
}

async function onNewContextTemplateClick() {
    const name = await inputTemplateName();

    if (!name) {
        return;
    }

    const template = { name: name, injections: [], storyString: '' };
    context_templates.push(template);
    const option = document.createElement('option');
    option.innerText = name;
    option.value = name;
    option.selected = true;
    $('#context_template').append(option).val(name).trigger('change');
    saveTemplateDebounced(name);
}

async function onDeleteContextTemplateClick() {
    const template = context_templates.find(x => x.name == context_settings.selected_template);

    if (!template || !context_settings.selected_template) {
        toastr.info('No context template selected');
        return;
    }

    const confirm = await callPopup('Are you sure?', 'confirm');

    if (!confirm) {
        return;
    }

    await deleteContextTemplate(context_settings.selected_template);
    $(`#context_template option[value="${context_settings.selected_template}"]`).remove();
    $('#context_template').trigger('change');
}

jQuery(() => {
    $('#context_template_edit').on('click', openContextTemplateEditor);
    $('#context_template').on('change', onContextTemplateChange);
    $('#context_template_new').on('click', onNewContextTemplateClick);
    $('#context_template_rename').on('click', onRenameContextTemplateClick);
    $('#context_template_delete').on('click', onDeleteContextTemplateClick);
    $(document).on('pointerup', '.template_parameters_list code', copyTemplateParameter);
})
