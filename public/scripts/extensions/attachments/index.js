import { renderExtensionTemplateAsync } from '../../extensions.js';

jQuery(async () => {
    const buttons = await renderExtensionTemplateAsync('attachments', 'buttons', {});
    $('#extensionsMenu').prepend(buttons);
});
