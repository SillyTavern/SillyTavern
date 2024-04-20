// eslint-disable-next-line no-unused-vars
import { SlashCommand } from './SlashCommand.js';
// eslint-disable-next-line no-unused-vars
import { SlashCommandClosure } from './SlashCommandClosure.js';
import { PARSER_FLAG } from './SlashCommandParser.js';

export class SlashCommandExecutor {
    /**@type {Boolean}*/ injectPipe = true;
    /**@type {Number}*/ start;
    /**@type {Number}*/ end;
    /**@type {String}*/ name = '';
    /**@type {SlashCommand}*/ command;
    // @ts-ignore
    /**@type {Object.<string,String|SlashCommandClosure>}*/ args = {};
    /**@type {String|SlashCommandClosure|(String|SlashCommandClosure)[]}*/ value;
    /**@type {Object<PARSER_FLAG,boolean>} */ parserFlags;

    constructor(start) {
        this.start = start;
    }
}
