import {
    addOneMessage,
    chat,
    chat_metadata,
    saveChatConditional,
    sendSystemMessage,
    system_avatar,
    system_message_types
} from "../script.js";
import { humanizedDateTime } from "./RossAscends-mods.js";
export {
    executeSlashCommands,
    registerSlashCommand,
    getSlashCommandsHelp,
}

class SlashCommandParser {
    constructor() {
        this.commands = {};
        this.helpStrings = [];
    }

    addCommand(command, callback, aliases, helpString = '', interruptsGeneration = false, purgeFromMessage = true) {
        const fnObj = { callback, helpString, interruptsGeneration, purgeFromMessage };

        if ([command, ...aliases].some(x => this.commands.hasOwnProperty(x))) {
            console.trace('WARN: Duplicate slash command registered!');
        }
    
        this.commands[command] = fnObj;

        if (Array.isArray(aliases)) {
            aliases.forEach((alias) => {
                this.commands[alias] = fnObj;
            });
        }

        let stringBuilder = `<span class="monospace">/${command}</span> ${helpString} `;
        if (Array.isArray(aliases) && aliases.length) {
            let aliasesString = `(aliases: ${aliases.map(x => `<span class="monospace">/${x}</span>`).join(', ')})`;
            stringBuilder += aliasesString;
        }
        this.helpStrings.push(stringBuilder);
    }

    parse(text) {
        const firstSpace = text.indexOf(' ');
        const command = firstSpace !== -1 ? text.substring(1, firstSpace) : text.substring(1);
        const args = firstSpace !== -1 ? text.substring(firstSpace + 1) : '';
        const argObj = {};
        let unnamedArg;

        if (args.length > 0) {
            const argsArray = args.split(' ');
            for (let arg of argsArray) {
                const equalsIndex = arg.indexOf('=');
                if (equalsIndex !== -1) {
                    const key = arg.substring(0, equalsIndex);
                    const value = arg.substring(equalsIndex + 1);
                    argObj[key] = value;
                }
                else {
                    break;
                }
            }

            unnamedArg = argsArray.slice(Object.keys(argObj).length).join(' ');
        }

        if (this.commands[command]) {
            return { command: this.commands[command], args: argObj, value: unnamedArg };
        }

        return false;
    }

    getHelpString() {
        const listItems = this.helpStrings.map(x => `<li>${x}</li>`).join('\n');
        return `<p>Slash commands:</p><ol>${listItems}</ol>`;
    }
}

const parser = new SlashCommandParser();
const registerSlashCommand = parser.addCommand.bind(parser);
const getSlashCommandsHelp = parser.getHelpString.bind(parser);

parser.addCommand('help', helpCommandCallback, ['?'], ' – displays this help message', true, true);
parser.addCommand('bg', setBackgroundCallback, ['background'], '<span class="monospace">(filename)</span> – sets a background according to filename, partial names allowed, will set the first one alphebetically if multiple files begin with the provided argument string', false, true);
parser.addCommand('sys', sendNarratorMessage, [], '<span class="monospace">(text)</span> – sends message as a system narrator', false, true);
parser.addCommand('sysname', setNarratorName, [], '<span class="monospace">(name)</span> – sets a name for future system narrator messages in this chat (display only). Default: System. Leave empty to reset.', true, true);

const NARRATOR_NAME_KEY = 'narrator_name';
const NARRATOR_NAME_DEFAULT = 'System';

function setNarratorName(_, text) {
    const name = text || NARRATOR_NAME_DEFAULT;
    chat_metadata[NARRATOR_NAME_KEY] = name;
    toastr.info(`System narrator name set to ${name}`);
    saveChatConditional();
}

function sendNarratorMessage(_, text) {
    if (!text) {
        return;
    }

    const name = chat_metadata[NARRATOR_NAME_KEY] || NARRATOR_NAME_DEFAULT;
    const message = {
        name: name,
        is_user: false,
        is_name: false,
        is_system: false,
        send_date: humanizedDateTime(),
        mes: text.trim(),
        force_avatar: system_avatar,
        extra: {
            type: system_message_types.NARRATOR,
        },
    };

    chat.push(message);
    addOneMessage(message);
    saveChatConditional();
}

function helpCommandCallback() {
    sendSystemMessage(system_message_types.HELP);
}

function setBackgroundCallback(_, bg) {
    if (!bg) {
        return;
    }
    console.log('Set background to ' + bg);
    const bgElement = $(`.bg_example[bgfile^="${bg.trim()}"`);

    if (bgElement.length) {
        bgElement.get(0).click();
    }
}

function executeSlashCommands(text) {
    if (!text) {
        return false;
    }

    // Hack to allow multi-line slash commands
    // All slash command messages should begin with a slash
    const lines = [text];
    const linesToRemove = [];

    let interrupt = false;

    for (let index = 0; index < lines.length; index++) {
        const trimmedLine = lines[index].trim();

        if (!trimmedLine.startsWith('/')) {
            continue;
        }

        const result = parser.parse(trimmedLine);

        if (!result) {
            continue;
        }

        result.command.callback(result.args, result.value);

        if (result.command.interruptsGeneration) {
            interrupt = true;
        }

        if (result.command.purgeFromMessage) {
            linesToRemove.push(lines[index]);
        }
    }

    const newText = lines.filter(x => linesToRemove.indexOf(x) === -1).join('\n');

    return { interrupt, newText };
}