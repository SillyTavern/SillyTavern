/** @typedef {import('./SlashCommandClosure.js').SlashCommandClosure} SlashCommandClosure */


export class SlashCommandNamedArgumentAssignment {
    /**@type {number}*/ start;
    /**@type {number}*/ end;
    /**@type {string}*/ name;
    /**@type {string|SlashCommandClosure}*/ value;


    constructor() {
    }
}
