import {
    sendSystemMessage,
    system_message_types
} from "../script.js";
export {
    executeSlashCommands,
    registerSlashCommand,
}

class SlashCommandParser {
    constructor() {
        this.commands = {};
    }

    addCommand(command, callback, aliases, helpString = '', interruptsGeneration = false, purgeFromMessage = true) {
        const fnObj = { callback, helpString, interruptsGeneration, purgeFromMessage };
        this.commands[command] = fnObj;

        if (Array.isArray(aliases)) {
            aliases.forEach((alias) => {
                this.commands[alias] = fnObj;
            });
        }
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
}

const parser = new SlashCommandParser();
const registerSlashCommand = parser.addCommand.bind(parser);

parser.addCommand('help', helpCommandCallback, ['?'], 'Displays a help information', true, true);
parser.addCommand('bg', setBackgroundCallback, ['background'], 'Sets a background', false, true);

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

    const lines = text.split('\n');
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