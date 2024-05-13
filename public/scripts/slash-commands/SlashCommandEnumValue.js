export class SlashCommandEnumValue {
    /**@type {string}*/ value;
    /**@type {string}*/ description;

    constructor(value, description = null) {
        this.value = value;
        this.description = description;
    }

    toString() {
        return this.value;
    }
}
