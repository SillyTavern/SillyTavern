export class SlashCommandEnumValue {
    /**@type {string}*/ value;
    /**@type {string}*/ description;
    /**@type {string}*/ type = 'enum';
    /**@type {string}*/ typeIcon = '◊';

    constructor(value, description = null, type = 'enum', typeIcon = '◊') {
        this.value = value;
        this.description = description;
        this.type = type;
        this.typeIcon = typeIcon;
    }

    toString() {
        return this.value;
    }
}
