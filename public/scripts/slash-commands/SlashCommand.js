import { SlashCommandArgument, SlashCommandNamedArgument } from './SlashCommandArgument.js';



export class SlashCommand {
    /**
     * Creates a SlashCommand from a properties object.
     * @param {Object} props
     * @param {string} [props.name]
     * @param {Function} [props.callback]
     * @param {string} [props.helpString]
     * @param {boolean} [props.interruptsGeneration]
     * @param {boolean} [props.purgeFromMessage]
     * @param {string[]} [props.aliases]
     * @param {string} [props.returns]
     * @param {SlashCommandNamedArgument[]} [props.namedArgumentList]
     * @param {SlashCommandArgument[]} [props.unnamedArgumentList]
     */
    static fromProps(props) {
        const instance = Object.assign(new this(), props);
        return instance;
    }




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
