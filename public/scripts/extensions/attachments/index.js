import { renderExtensionTemplateAsync } from '../../extensions.js';
import { registerSlashCommand } from '../../slash-commands.js';

jQuery(async () => {
    const buttons = await renderExtensionTemplateAsync('attachments', 'buttons', {});
    $('#extensionsMenu').prepend(buttons);

    registerSlashCommand('db', () => document.getElementById('manageAttachments')?.click(), ['databank', 'data-bank'], '– open the data bank', true, true);
});
