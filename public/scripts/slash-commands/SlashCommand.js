import { SlashCommandArgument, SlashCommandNamedArgument } from './SlashCommandArgument.js';



export class SlashCommand {
    /**@type {string}*/ name;
    /**@type {Function}*/ callback;
    /**@type {string}*/ helpString;
    /**@type {boolean}*/ interruptsGeneration = true;
    /**@type {boolean}*/ purgeFromMessage = true;
    /**@type {string[]}*/ aliases = [];
    /**@type {string}*/ returns;
    /**@type {SlashCommandNamedArgument[]}*/ namedArgumentList = [];
    /**@type {SlashCommandArgument[]}*/ unnamedArgumentList = [];

    get helpStringFormatted() {
        let aliases = '';
        if (this.aliases?.length > 0) {
            aliases = ' (alias: ';
            aliases += this.aliases
                .map(it=>`<span class="monospace">/${it}</span>`)
                .join(', ')
            ;
            aliases += ')';
        }
        return `<span class="monospace">/${this.name}</span> ${this.helpString}${aliases}`;
    }
}
