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
import { SlashCommandScope } from './SlashCommandScope.js';

export class SlashCommandAutoCompleteNameResult extends AutoCompleteNameResult {
    /**@type {SlashCommandExecutor}*/ executor;
    /**@type {SlashCommandScope}*/ scope;

    /**
     * @param {SlashCommandExecutor} executor
     * @param {SlashCommandScope} scope
     * @param {Object.<string,SlashCommand>} commands
     */
    constructor(executor, scope, commands) {
        super(
            executor.name,
            executor.start,
            Object
                .keys(commands)
                .map(key=>new SlashCommandCommandAutoCompleteOption(commands[key], key))
            ,
            false,
            ()=>`No matching slash commands for "/${this.name}"`,
            ()=>'No slash commands found!',
        );
        this.executor = executor;
        this.scope = scope;
    }

    getSecondaryNameAt(text, index, isSelect) {
        const namedResult = this.getNamedArgumentAt(text, index, isSelect);
        if (!namedResult || namedResult.optionList.length == 0 || !namedResult.isRequired) {
            const unnamedResult = this.getUnnamedArgumentAt(text, index, isSelect);
            if (!namedResult) return unnamedResult;
            if (namedResult && unnamedResult) {
                const combinedResult = new AutoCompleteSecondaryNameResult(
                    namedResult.name,
                    namedResult.start,
                    [...namedResult.optionList, ...unnamedResult.optionList],
                );
                combinedResult.isRequired = namedResult.isRequired || unnamedResult.isRequired;
                combinedResult.forceMatch = namedResult.forceMatch && unnamedResult.forceMatch;
                return combinedResult;
            }
        }
        return namedResult;
    }

    getNamedArgumentAt(text, index, isSelect) {
        function getSplitRegex() {
            try {
                return new RegExp('(?<==)');
            } catch {
                // For browsers that don't support lookbehind
                return new RegExp('=(.*)');
            }
        }
        if (!Array.isArray(this.executor.command?.namedArgumentList)) {
            return null;
        }
        const notProvidedNamedArguments = this.executor.command.namedArgumentList.filter(arg=>!this.executor.namedArgumentList.find(it=>it.name == arg.name));
        let name;
        let value;
        let start;
        let cmdArg;
        let argAssign;
        const unamedArgLength = this.executor.endUnnamedArgs - this.executor.startUnnamedArgs;
        const namedArgsFollowedBySpace = text[this.executor.endNamedArgs] == ' ';
        if (this.executor.startNamedArgs <= index && this.executor.endNamedArgs + (namedArgsFollowedBySpace ? 1 : 0) >= index) {
            // cursor is somewhere within the named arguments (including final space)
            argAssign = this.executor.namedArgumentList.find(it=>it.start <= index && it.end >= index);
            if (argAssign) {
                const [argName, ...v] = text.slice(argAssign.start, index).split(getSplitRegex());
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
            // if index is in first array item and that is a string, treat it as an unfinished named arg
            if (typeof this.executor.unnamedArgumentList[0]?.value == 'string') {
                if (index <= this.executor.startUnnamedArgs + this.executor.unnamedArgumentList[0].value.length) {
                    name = this.executor.unnamedArgumentList[0].value.slice(0, index - this.executor.startUnnamedArgs);
                    start = this.executor.startUnnamedArgs;
                } else {
                    return null;
                }
            } else {
                return null;
            }
        } else {
            return null;
        }

        if (name.includes('=') && cmdArg) {
            // if cursor is already behind "=" check for enums
            const enumList = cmdArg?.enumProvider?.(this.executor, this.scope) ?? cmdArg?.enumList;
            if (cmdArg && enumList?.length) {
                if (isSelect && enumList.find(it=>it.value == value) && argAssign && argAssign.end == index) {
                    return null;
                }
                const result = new AutoCompleteSecondaryNameResult(
                    value,
                    start + name.length,
                    enumList.map(it=>SlashCommandEnumAutoCompleteOption.from(this.executor.command, it)),
                    true,
                );
                result.isRequired = true;
                result.forceMatch = cmdArg.forceEnum;
                return result;
            }
        }

        if (notProvidedNamedArguments.length > 0) {
            const result = new AutoCompleteSecondaryNameResult(
                name,
                start,
                notProvidedNamedArguments.map(it=>new SlashCommandNamedArgumentAutoCompleteOption(it, this.executor.command)),
                false,
            );
            result.isRequired = notProvidedNamedArguments.find(it=>it.isRequired) != null;
            return result;
        }

        return null;
    }

    getUnnamedArgumentAt(text, index, isSelect) {
        if (!Array.isArray(this.executor.command?.unnamedArgumentList)) {
            return null;
        }
        const lastArgIsBlank = this.executor.unnamedArgumentList.slice(-1)[0]?.value == '';
        const notProvidedArguments = this.executor.command.unnamedArgumentList.slice(this.executor.unnamedArgumentList.length - (lastArgIsBlank ? 1 : 0));
        let value;
        let start;
        let cmdArg;
        let argAssign;
        if (this.executor.startUnnamedArgs <= index && this.executor.endUnnamedArgs + 1 >= index) {
            // cursor is somwehere in the unnamed args
            const idx = this.executor.unnamedArgumentList.findIndex(it=>it.start <= index && it.end >= index);
            if (idx > -1) {
                argAssign = this.executor.unnamedArgumentList[idx];
                cmdArg = this.executor.command.unnamedArgumentList[idx];
                if (cmdArg === undefined && this.executor.command.unnamedArgumentList.slice(-1)[0]?.acceptsMultiple) {
                    cmdArg = this.executor.command.unnamedArgumentList.slice(-1)[0];
                }
                const enumList = cmdArg?.enumProvider?.(this.executor, this.scope) ?? cmdArg?.enumList;
                if (cmdArg && enumList.length > 0) {
                    value = argAssign.value.toString().slice(0, index - argAssign.start);
                    start = argAssign.start;
                } else {
                    return null;
                }
            } else {
                value = '';
                start = index;
                cmdArg = notProvidedArguments[0];
                if (cmdArg === undefined && this.executor.command.unnamedArgumentList.slice(-1)[0]?.acceptsMultiple) {
                    cmdArg = this.executor.command.unnamedArgumentList.slice(-1)[0];
                }
            }
        } else {
            return null;
        }

        const enumList = cmdArg?.enumProvider?.(this.executor, this.scope) ?? cmdArg?.enumList;
        if (cmdArg == null || enumList.length == 0) return null;

        const result = new AutoCompleteSecondaryNameResult(
            value,
            start,
            enumList.map(it=>SlashCommandEnumAutoCompleteOption.from(this.executor.command, it)),
            false,
        );
        const isCompleteValue = enumList.find(it=>it.value == value);
        const isSelectedValue = isSelect && isCompleteValue;
        result.isRequired = cmdArg.isRequired && !isSelectedValue;
        result.forceMatch = cmdArg.forceEnum;
        return result;
    }
}
