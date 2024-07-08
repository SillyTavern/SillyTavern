// eslint-disable-next-line no-unused-vars
import { uuidv4 } from '../utils.js';
import { SlashCommand } from './SlashCommand.js';
// eslint-disable-next-line no-unused-vars
import { SlashCommandClosure } from './SlashCommandClosure.js';
import { SlashCommandNamedArgumentAssignment } from './SlashCommandNamedArgumentAssignment.js';
// eslint-disable-next-line no-unused-vars
import { PARSER_FLAG } from './SlashCommandParser.js';
import { SlashCommandUnnamedArgumentAssignment } from './SlashCommandUnnamedArgumentAssignment.js';

export class SlashCommandExecutor {
    /**@type {Boolean}*/ injectPipe = true;
    /**@type {Number}*/ start;
    /**@type {Number}*/ end;
    /**@type {Number}*/ startNamedArgs;
    /**@type {Number}*/ endNamedArgs;
    /**@type {Number}*/ startUnnamedArgs;
    /**@type {Number}*/ endUnnamedArgs;
    /**@type {String}*/ name = '';
    /**@type {String}*/ #source = uuidv4();
    get source() { return this.#source; }
    set source(value) {
        this.#source = value;
        for (const arg of this.namedArgumentList.filter(it=>it.value instanceof SlashCommandClosure)) {
            arg.value.source = value;
        }
        for (const arg of this.unnamedArgumentList.filter(it=>it.value instanceof SlashCommandClosure)) {
            arg.value.source = value;
        }
    }
    /**@type {SlashCommand}*/ command;
    // @ts-ignore
    /**@type {SlashCommandNamedArgumentAssignment[]}*/ namedArgumentList = [];
    /**@type {SlashCommandUnnamedArgumentAssignment[]}*/ unnamedArgumentList = [];
    /**@type {{[id:PARSER_FLAG]:boolean}} */ parserFlags;

    get commandCount() {
        return 1
            + this.namedArgumentList.filter(it=>it.value instanceof SlashCommandClosure).map(it=>/**@type {SlashCommandClosure}*/(it.value).commandCount).reduce((cur, sum)=>cur + sum, 0)
            + this.unnamedArgumentList.filter(it=>it.value instanceof SlashCommandClosure).map(it=>/**@type {SlashCommandClosure}*/(it.value).commandCount).reduce((cur, sum)=>cur + sum, 0)
        ;
    }

    set onProgress(value) {
        const closures = /**@type {SlashCommandClosure[]}*/([
            ...this.namedArgumentList.filter(it=>it.value instanceof SlashCommandClosure).map(it=>it.value),
            ...this.unnamedArgumentList.filter(it=>it.value instanceof SlashCommandClosure).map(it=>it.value),
        ]);
        for (const closure of closures) {
            closure.onProgress = value;
        }
    }

    constructor(start) {
        this.start = start;
    }
}
