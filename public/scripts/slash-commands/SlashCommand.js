import { SlashCommandArgument, SlashCommandNamedArgument } from './SlashCommandArgument.js';



export class SlashCommand {
    /**
     * Creates a SlashCommand from a properties object.
     * @param {Object} props
     * @param {string} [props.name]
     * @param {Function} [props.callback]
     * @param {string} [props.helpString]
     * @param {boolean} [props.interruptsGeneration]
     * @param {boolean} [props.purgeFromMessage]
     * @param {string[]} [props.aliases]
     * @param {string} [props.returns]
     * @param {SlashCommandNamedArgument[]} [props.namedArgumentList]
     * @param {SlashCommandArgument[]} [props.unnamedArgumentList]
     */
    static fromProps(props) {
        const instance = Object.assign(new this(), props);
        return instance;
    }




    /**@type {string}*/ name;
    /**@type {Function}*/ callback;
    /**@type {string}*/ helpString;
    /**@type {boolean}*/ interruptsGeneration = true;
    /**@type {boolean}*/ purgeFromMessage = true;
    /**@type {string[]}*/ aliases = [];
    /**@type {string}*/ returns;
    /**@type {SlashCommandNamedArgument[]}*/ namedArgumentList = [];
    /**@type {SlashCommandArgument[]}*/ unnamedArgumentList = [];

    get helpStringFormatted() {
        let aliases = '';
        if (this.aliases?.length > 0) {
            aliases = ' (alias: ';
            aliases += this.aliases
                .map(it=>`<span class="monospace">/${it}</span>`)
                .join(', ')
            ;
            aliases += ')';
        }
        return `<span class="monospace">/${this.name}</span> ${this.helpString}${aliases}`;
    }

    renderHelpItem(key = null) {
        key = key ?? this.name;
        const typeIcon = '/';
        const li = document.createElement('li'); {
            li.classList.add('item');
            const type = document.createElement('span'); {
                type.classList.add('type');
                type.classList.add('monospace');
                type.textContent = typeIcon;
                li.append(type);
            }
            const specs = document.createElement('span'); {
                specs.classList.add('specs');
                const name = document.createElement('span'); {
                    name.classList.add('name');
                    name.classList.add('monospace');
                    name.textContent = '/';
                    key.split('').forEach(char=>{
                        const span = document.createElement('span'); {
                            span.textContent = char;
                            name.append(span);
                        }
                    });
                    specs.append(name);
                }
                const body = document.createElement('span'); {
                    body.classList.add('body');
                    const args = document.createElement('span'); {
                        args.classList.add('arguments');
                        for (const arg of this.namedArgumentList) {
                            const argItem = document.createElement('span'); {
                                argItem.classList.add('argument');
                                argItem.classList.add('namedArgument');
                                if (!arg.isRequired || (arg.defaultValue ?? false)) argItem.classList.add('optional');
                                if (arg.acceptsMultiple) argItem.classList.add('multiple');
                                const name = document.createElement('span'); {
                                    name.classList.add('argument-name');
                                    name.textContent = arg.name;
                                    argItem.append(name);
                                }
                                if (arg.enumList.length > 0) {
                                    const enums = document.createElement('span'); {
                                        enums.classList.add('argument-enums');
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
                                args.append(argItem);
                            }
                        }
                        for (const arg of this.unnamedArgumentList) {
                            const argItem = document.createElement('span'); {
                                argItem.classList.add('argument');
                                argItem.classList.add('unnamedArgument');
                                if (!arg.isRequired || (arg.defaultValue ?? false)) argItem.classList.add('optional');
                                if (arg.acceptsMultiple) argItem.classList.add('multiple');
                                if (arg.enumList.length > 0) {
                                    const enums = document.createElement('span'); {
                                        enums.classList.add('argument-enums');
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
                                args.append(argItem);
                            }
                        }
                        body.append(args);
                    }
                    const returns = document.createElement('span'); {
                        returns.classList.add('returns');
                        returns.textContent = this.returns ?? 'void';
                        body.append(returns);
                    }
                    specs.append(body);
                }
                li.append(specs);
            }
            const help = document.createElement('span'); {
                help.classList.add('help');
                const content = document.createElement('span'); {
                    content.classList.add('helpContent');
                    content.innerHTML = this.helpString;
                    const text = content.textContent;
                    content.innerHTML = '';
                    content.textContent = text;
                    help.append(content);
                }
                li.append(help);
            }
            if (this.aliases.length > 0) {
                const aliases = document.createElement('span'); {
                    aliases.classList.add('aliases');
                    aliases.append(' (alias: ');
                    for (const aliasName of this.aliases) {
                        const alias = document.createElement('span'); {
                            alias.classList.add('monospace');
                            alias.textContent = `/${aliasName}`;
                            aliases.append(alias);
                        }
                    }
                    aliases.append(')');
                    // li.append(aliases);
                }
            }
        }
        return li;
    }
}
