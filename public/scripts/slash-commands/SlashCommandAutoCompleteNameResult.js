import { AutoCompleteNameResult } from '../autocomplete/AutoCompleteNameResult.js';
import { AutoCompleteOption } from '../autocomplete/AutoCompleteOption.js';
import { AutoCompleteSecondaryNameResult } from '../autocomplete/AutoCompleteSecondaryNameResult.js';
import { SlashCommand } from './SlashCommand.js';
import { SlashCommandNamedArgument } from './SlashCommandArgument.js';
import { SlashCommandClosure } from './SlashCommandClosure.js';
import { SlashCommandCommandAutoCompleteOption } from './SlashCommandCommandAutoCompleteOption.js';
import { SlashCommandEnumAutoCompleteOption } from './SlashCommandEnumAutoCompleteOption.js';
import { SlashCommandExecutor } from './SlashCommandExecutor.js';
import { SlashCommandNamedArgumentAutoCompleteOption } from './SlashCommandNamedArgumentAutoCompleteOption.js';

export class SlashCommandAutoCompleteNameResult extends AutoCompleteNameResult {
    /**@type {SlashCommandExecutor}*/ executor;

    /**
     * @param {SlashCommandExecutor} executor
     * @param {Object.<string,SlashCommand>} commands
     */
    constructor(executor, commands) {
        super(
            executor.name,
            executor.start - 2,
            Object
                .keys(commands)
                .map(key=>new SlashCommandCommandAutoCompleteOption(commands[key], key))
            ,
            false,
            ()=>`No matching slash commands for "/${this.name}"`,
            ()=>'No slash commands found!',
        );
        this.executor = executor;
    }

    getSecondaryNameAt(text, index, isSelect) {
        text = `{:${text}:}`;
        let result = this.getNamedArgumentAt(text, index, isSelect);
        return result;
    }

    getNamedArgumentAt(text, index, isSelect) {
        const notProvidedNamedArguments = this.executor.command.namedArgumentList.filter(arg=>!this.executor.namedArgumentList.find(it=>it.name == arg.name));
        let name;
        let value;
        let start;
        let cmdArg;
        let argAssign;
        index = index + 2;
        const unamedArgLength = this.executor.endUnnamedArgs - this.executor.startUnnamedArgs;
        if (this.executor.startNamedArgs <= index && this.executor.endNamedArgs + 1 >= index) {
            // cursor is somewhere within the named arguments (including final space)
            argAssign = this.executor.namedArgumentList.find(it=>it.start <= index && it.end >= index);
            if (argAssign) {
                const [argName, ...v] = text.slice(argAssign.start, index).split(/(?<==)/);
                name = argName;
                value = v.join('');
                start = argAssign.start;
                cmdArg = this.executor.command.namedArgumentList.find(it=>[it.name, `${it.name}=`].includes(argAssign.name));
                if (cmdArg) notProvidedNamedArguments.push(cmdArg);
            } else {
                name = '';
                start = index;
            }
        } else if (unamedArgLength > 0 && index >= this.executor.startUnnamedArgs && index <= this.executor.endUnnamedArgs) {
            // cursor is somewhere within the unnamed arguments
            if (Array.isArray(this.executor.value)) {
                //TODO if index is in first array item and that is a string, treat it as an unfinished named arg
                return null;
            } else if (this.executor.value instanceof SlashCommandClosure) {
                // can't do anything with closures, shouldn't ever reach this
                return null;
            } else {
                const text = this.executor.value.slice(0, index - this.executor.startUnnamedArgs);
                if (/\s/.test(text)) {
                    // if the text up to index includes whitespace it can't be the name of a named arg
                    return null;
                }
                name = text;
                start = this.executor.startUnnamedArgs;
            }
        } else {
            return null;
        }

        if (name.includes('=') && cmdArg) {
            // if cursor is already behind "=" check for enums
            /**@type {SlashCommandNamedArgument} */
            if (cmdArg && cmdArg.enumList?.length) {
                if (isSelect && cmdArg.enumList.includes(value) && argAssign && argAssign.end == index) {
                    return null;
                }
                const result = new AutoCompleteSecondaryNameResult(
                    value,
                    start + name.length - 2,
                    cmdArg.enumList.map(it=>new SlashCommandEnumAutoCompleteOption(it)),
                    true,
                );
                result.isRequired = true;
                return result;
            }
        }

        const result = new AutoCompleteSecondaryNameResult(
            name,
            start - 2,
            notProvidedNamedArguments.map(it=>new SlashCommandNamedArgumentAutoCompleteOption(it, this.executor.command)),
            false,
        );
        result.isRequired = notProvidedNamedArguments.find(it=>it.isRequired) != null;
        return result;
    }

    getEnumAt(index) {
        //TODO named arg enum
        //TODO unnamed arg enum
    }
}
