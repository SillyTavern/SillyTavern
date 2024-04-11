export class SlashCommand {
    /**@type {String}*/ name;
    /**@type {Function}*/ callback;
    /**@type {String}*/ helpString;
    /**@type {Boolean}*/ interruptsGeneration;
    /**@type {Boolean}*/ purgeFromMessage;
    /**@type {String[]}*/ aliases;

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
        return `<span class="monospace">/${this.name}</span>${this.helpString}${aliases}`;
    }
}
