// eslint-disable-next-line no-unused-vars
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
    /**@type {SlashCommand}*/ command;
    // @ts-ignore
    /**@type {SlashCommandNamedArgumentAssignment[]}*/ namedArgumentList = [];
    /**@type {SlashCommandUnnamedArgumentAssignment[]}*/ unnamedArgumentList = [];
    /**@type {Object<PARSER_FLAG,boolean>} */ parserFlags;

    constructor(start) {
        this.start = start;
    }
}
