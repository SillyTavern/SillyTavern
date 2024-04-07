export class SlashCommand {
    /**@type {String}*/ name;
    /**@type {Function}*/ callback;
    /**@type {String}*/ helpString;
    /**@type {Boolean}*/ interruptsGeneration;
    /**@type {Boolean}*/ purgeFromMessage;
    /**@type {String[]}*/ aliases;
}
