import { SlashCommandAbortController } from './SlashCommandAbortController.js';
import { SlashCommandArgument, SlashCommandNamedArgument } from './SlashCommandArgument.js';
import { SlashCommandClosure } from './SlashCommandClosure.js';
import { SlashCommandDebugController } from './SlashCommandDebugController.js';
import { PARSER_FLAG } from './SlashCommandParser.js';
import { SlashCommandScope } from './SlashCommandScope.js';




/**
 * @typedef {{
 * _scope:SlashCommandScope,
 * _parserFlags:{[id:PARSER_FLAG]:boolean},
 * _abortController:SlashCommandAbortController,
 * _debugController:SlashCommandDebugController,
 * _hasUnnamedArgument:boolean,
 * [id:string]:string|SlashCommandClosure,
 * }} NamedArguments
 */

/**
 * Alternative object for local JSDocs, where you don't need existing pipe, scope, etc. arguments
 * @typedef {{[id:string]:string|SlashCommandClosure}} NamedArgumentsCapture
 */

/**
 * @typedef {string|SlashCommandClosure|(string|SlashCommandClosure)[]} UnnamedArguments
*/



export class SlashCommand {
    /**
     * Creates a SlashCommand from a properties object.
     * @param {Object} props
     * @param {string} [props.name]
     * @param {(namedArguments:NamedArguments|NamedArgumentsCapture, unnamedArguments:string|SlashCommandClosure|(string|SlashCommandClosure)[])=>string|SlashCommandClosure|Promise<string|SlashCommandClosure>} [props.callback]
     * @param {string} [props.helpString]
     * @param {boolean} [props.splitUnnamedArgument]
     * @param {Number} [props.splitUnnamedArgumentCount]
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
    /**@type {(namedArguments:{_scope:SlashCommandScope, _abortController:SlashCommandAbortController, [id:string]:string|SlashCommandClosure}, unnamedArguments:string|SlashCommandClosure|(string|SlashCommandClosure)[])=>string|SlashCommandClosure|Promise<string|SlashCommandClosure>}*/ callback;
    /**@type {string}*/ helpString;
    /**@type {boolean}*/ splitUnnamedArgument = false;
    /**@type {Number}*/ splitUnnamedArgumentCount;
    /**@type {string[]}*/ aliases = [];
    /**@type {string}*/ returns;
    /**@type {SlashCommandNamedArgument[]}*/ namedArgumentList = [];
    /**@type {SlashCommandArgument[]}*/ unnamedArgumentList = [];

    /**@type {Object.<string, HTMLElement>}*/ helpCache = {};
    /**@type {Object.<string, DocumentFragment>}*/ helpDetailsCache = {};

    /**@type {boolean}*/ isExtension = false;
    /**@type {boolean}*/ isThirdParty = false;
    /**@type {string}*/ source;

    renderHelpItem(key = null) {
        key = key ?? this.name;
        if (!this.helpCache[key]) {
            const typeIcon = '[/]';
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
                                                    enumItem.textContent = e.value;
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
                                                    enumItem.textContent = e.value;
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
                const stopgap = document.createElement('span'); {
                    stopgap.classList.add('stopgap');
                    stopgap.textContent = '';
                    li.append(stopgap);
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
            this.helpCache[key] = li;
        }
        return /**@type {HTMLElement}*/(this.helpCache[key].cloneNode(true));
    }

    renderHelpDetails(key = null) {
        key = key ?? this.name;
        if (!this.helpDetailsCache[key]) {
            const frag = document.createDocumentFragment();
            const cmd = this;
            const namedArguments = cmd.namedArgumentList ?? [];
            const unnamedArguments = cmd.unnamedArgumentList ?? [];
            const returnType = cmd.returns ?? 'void';
            const helpString = cmd.helpString ?? 'NO DETAILS';
            const aliasList = [cmd.name, ...(cmd.aliases ?? [])].filter(it=>it != key);
            const specs = document.createElement('div'); {
                specs.classList.add('specs');
                const head = document.createElement('div'); {
                    head.classList.add('head');
                    const name = document.createElement('div'); {
                        name.classList.add('name');
                        name.classList.add('monospace');
                        name.title = 'command name';
                        name.textContent = `/${key}`;
                        head.append(name);
                    }
                    const src = document.createElement('div'); {
                        src.classList.add('source');
                        src.classList.add('fa-solid');
                        if (this.isExtension) {
                            src.classList.add('isExtension');
                            src.classList.add('fa-cubes');
                            if (this.isThirdParty) src.classList.add('isThirdParty');
                            else src.classList.add('isCore');
                        } else {
                            src.classList.add('isCore');
                            src.classList.add('fa-star-of-life');
                        }
                        src.title = [
                            this.isExtension ? 'Extension' : 'Core',
                            this.isThirdParty ? 'Third Party' : (this.isExtension ? 'Core' : null),
                            this.source,
                        ].filter(it=>it).join('\n');
                        head.append(src);
                    }
                    specs.append(head);
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
                                                        enumItem.textContent = e.value;
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
                                const argSpec = document.createElement('div'); {
                                    argSpec.classList.add('argumentSpec');
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
                                                        enumItem.textContent = e.value;
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
                for (const code of help.querySelectorAll('pre > code')) {
                    code.classList.add('language-stscript');
                    hljs.highlightElement(code);
                }
                frag.append(help);
            }
            if (aliasList.length > 0) {
                const aliases = document.createElement('span'); {
                    aliases.classList.add('aliases');
                    for (const aliasName of aliasList) {
                        const alias = document.createElement('span'); {
                            alias.classList.add('alias');
                            alias.textContent = `/${aliasName}`;
                            aliases.append(alias);
                        }
                    }
                    frag.append(aliases);
                }
            }
            this.helpDetailsCache[key] = frag;
        }
        const frag = document.createDocumentFragment();
        frag.append(this.helpDetailsCache[key].cloneNode(true));
        return frag;
    }
}
