import { renderExtensionTemplateAsync } from '../../extensions.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';

jQuery(async () => {
    const buttons = await renderExtensionTemplateAsync('attachments', 'buttons', {});
    $('#extensionsMenu').prepend(buttons);

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'db',
        callback: () => document.getElementById('manageAttachments')?.click(),
        aliases: ['databank', 'data-bank'],
        helpString: 'Open the data bank',
    }));

});
