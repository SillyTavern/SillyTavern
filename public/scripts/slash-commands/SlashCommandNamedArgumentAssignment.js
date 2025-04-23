import { SlashCommandClosure } from './SlashCommandClosure.js';

export class SlashCommandNamedArgumentAssignment {
    /** @type {number} */ start;
    /** @type {number} */ end;
    /** @type {string} */ name;
    /** @type {string|SlashCommandClosure} */ value;


    constructor() {
    }
}
