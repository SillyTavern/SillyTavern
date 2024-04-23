import { SlashCommand } from './SlashCommand.js';



/**@readonly*/
/**@enum {Number}*/
export const OPTION_TYPE = {
    'COMMAND': 1,
    'QUICK_REPLY': 2,
    'VARIABLE_NAME': 3,
    'BLANK': 4,
};

export class SlashCommandFuzzyScore {
    /**@type {number}*/ start;
    /**@type {number}*/ longestConsecutive;

    /**
     * @param {number} start
     * @param {number} longestConsecutive
     */
    constructor(start, longestConsecutive) {
        this.start = start;
        this.longestConsecutive = longestConsecutive;
    }
}


export class SlashCommandAutoCompleteOption {
    /**@type {OPTION_TYPE}*/ type;
    /**@type {string|SlashCommand}*/ value;
    /**@type {string}*/ name;
    /**@type {SlashCommandFuzzyScore}*/ score;
    /**@type {string}*/ replacer;
    /**@type {HTMLElement}*/ dom;


    /**
     * @param {OPTION_TYPE} type
     * @param {string|SlashCommand} value
     * @param {string} name
     */
    constructor(type, value, name) {
        this.type = type;
        this.value = value;
        this.name = name;
    }


    renderDetails() {
        switch (this.type) {
            case OPTION_TYPE.COMMAND: {
                return this.renderCommandDetails();
            }
            case OPTION_TYPE.QUICK_REPLY: {
                return this.renderQuickReplyDetails();
            }
            case OPTION_TYPE.VARIABLE_NAME: {
                return this.renderVariableDetails();
            }
            default: {
                return this.renderBlankDetails();
            }
        }
    }
    renderBlankDetails() {
        return 'BLANK';
    }
    renderQuickReplyDetails() {
        const frag = document.createDocumentFragment();
        const specs = document.createElement('div'); {
            specs.classList.add('specs');
            const name = document.createElement('div'); {
                name.classList.add('name');
                name.classList.add('monospace');
                name.textContent = this.value.toString();
                specs.append(name);
            }
            frag.append(specs);
        }
        const help = document.createElement('span'); {
            help.classList.add('help');
            help.textContent = 'Quick Reply';
            frag.append(help);
        }
        return frag;
    }
    renderVariableDetails() {
        const frag = document.createDocumentFragment();
        const specs = document.createElement('div'); {
            specs.classList.add('specs');
            const name = document.createElement('div'); {
                name.classList.add('name');
                name.classList.add('monospace');
                name.textContent = this.value.toString();
                specs.append(name);
            }
            frag.append(specs);
        }
        const help = document.createElement('span'); {
            help.classList.add('help');
            help.textContent = 'scoped variable';
            frag.append(help);
        }
        return frag;
    }
    renderCommandDetails() {
        const frag = document.createDocumentFragment();
        const key = this.name;
        /**@type {SlashCommand} */
        // @ts-ignore
        const cmd = this.value;
        const namedArguments = cmd.namedArgumentList ?? [];
        const unnamedArguments = cmd.unnamedArgumentList ?? [];
        const returnType = cmd.returns ?? 'void';
        const helpString = cmd.helpString ?? 'NO DETAILS';
        const aliasList = [cmd.name, ...(cmd.aliases ?? [])].filter(it=>it != key);
        const specs = document.createElement('div'); {
            specs.classList.add('specs');
            const name = document.createElement('div'); {
                name.classList.add('name');
                name.classList.add('monospace');
                name.title = 'command name';
                name.textContent = `/${key}`;
                specs.append(name);
            }
            const body = document.createElement('div'); {
                body.classList.add('body');
                const args = document.createElement('ul'); {
                    args.classList.add('arguments');
                    for (const arg of namedArguments) {
                        const listItem = document.createElement('li'); {
                            listItem.classList.add('argumentItem');
                            const argSpec = document.createElement('div'); {
                                argSpec.classList.add('argumentSpec');
                                const argItem = document.createElement('div'); {
                                    argItem.classList.add('argument');
                                    argItem.classList.add('namedArgument');
                                    argItem.title = `${arg.isRequired ? '' : 'optional '}named argument`;
                                    if (!arg.isRequired || (arg.defaultValue ?? false)) argItem.classList.add('optional');
                                    if (arg.acceptsMultiple) argItem.classList.add('multiple');
                                    const name = document.createElement('span'); {
                                        name.classList.add('argument-name');
                                        name.title = `${argItem.title} - name`;
                                        name.textContent = arg.name;
                                        argItem.append(name);
                                    }
                                    if (arg.enumList.length > 0) {
                                        const enums = document.createElement('span'); {
                                            enums.classList.add('argument-enums');
                                            enums.title = `${argItem.title} - accepted values`;
                                            for (const e of arg.enumList) {
                                                const enumItem = document.createElement('span'); {
                                                    enumItem.classList.add('argument-enum');
                                                    enumItem.textContent = e;
                                                    enums.append(enumItem);
                                                }
                                            }
                                            argItem.append(enums);
                                        }
                                    } else {
                                        const types = document.createElement('span'); {
                                            types.classList.add('argument-types');
                                            types.title = `${argItem.title} - accepted types`;
                                            for (const t of arg.typeList) {
                                                const type = document.createElement('span'); {
                                                    type.classList.add('argument-type');
                                                    type.textContent = t;
                                                    types.append(type);
                                                }
                                            }
                                            argItem.append(types);
                                        }
                                    }
                                    argSpec.append(argItem);
                                }
                                if (arg.defaultValue !== null) {
                                    const argDefault = document.createElement('div'); {
                                        argDefault.classList.add('argument-default');
                                        argDefault.title = 'default value';
                                        argDefault.textContent = arg.defaultValue.toString();
                                        argSpec.append(argDefault);
                                    }
                                }
                                listItem.append(argSpec);
                            }
                            const desc = document.createElement('div'); {
                                desc.classList.add('argument-description');
                                desc.innerHTML = arg.description;
                                listItem.append(desc);
                            }
                            args.append(listItem);
                        }
                    }
                    for (const arg of unnamedArguments) {
                        const listItem = document.createElement('li'); {
                            listItem.classList.add('argumentItem');
                            const argItem = document.createElement('div'); {
                                argItem.classList.add('argument');
                                argItem.classList.add('unnamedArgument');
                                argItem.title = `${arg.isRequired ? '' : 'optional '}unnamed argument`;
                                if (!arg.isRequired || (arg.defaultValue ?? false)) argItem.classList.add('optional');
                                if (arg.acceptsMultiple) argItem.classList.add('multiple');
                                if (arg.enumList.length > 0) {
                                    const enums = document.createElement('span'); {
                                        enums.classList.add('argument-enums');
                                        enums.title = `${argItem.title} - accepted values`;
                                        for (const e of arg.enumList) {
                                            const enumItem = document.createElement('span'); {
                                                enumItem.classList.add('argument-enum');
                                                enumItem.textContent = e;
                                                enums.append(enumItem);
                                            }
                                        }
                                        argItem.append(enums);
                                    }
                                } else {
                                    const types = document.createElement('span'); {
                                        types.classList.add('argument-types');
                                        types.title = `${argItem.title} - accepted types`;
                                        for (const t of arg.typeList) {
                                            const type = document.createElement('span'); {
                                                type.classList.add('argument-type');
                                                type.textContent = t;
                                                types.append(type);
                                            }
                                        }
                                        argItem.append(types);
                                    }
                                }
                                listItem.append(argItem);
                            }
                            const desc = document.createElement('div'); {
                                desc.classList.add('argument-description');
                                desc.innerHTML = arg.description;
                                listItem.append(desc);
                            }
                            args.append(listItem);
                        }
                    }
                    body.append(args);
                }
                const returns = document.createElement('span'); {
                    returns.classList.add('returns');
                    returns.title = [null, undefined, 'void'].includes(returnType) ? 'command does not return anything' : 'return value';
                    returns.textContent = returnType ?? 'void';
                    body.append(returns);
                }
                specs.append(body);
            }
            frag.append(specs);
        }
        const help = document.createElement('span'); {
            help.classList.add('help');
            help.innerHTML = helpString;
            frag.append(help);
        }
        if (aliasList.length > 0) {
            const aliases = document.createElement('span'); {
                aliases.classList.add('aliases');
                aliases.append(' (alias: ');
                for (const aliasName of aliasList) {
                    const alias = document.createElement('span'); {
                        alias.classList.add('monospace');
                        alias.textContent = `/${aliasName}`;
                        aliases.append(alias);
                    }
                }
                aliases.append(')');
                frag.append(aliases);
            }
        }
        return frag;
    }
}
