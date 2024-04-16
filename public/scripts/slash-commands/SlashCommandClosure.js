import { substituteParams } from '../../script.js';
import { escapeRegex } from '../utils.js';
import { SlashCommandClosureExecutor } from './SlashCommandClosureExecutor.js';
import { SlashCommandClosureResult } from './SlashCommandClosureResult.js';
import { SlashCommandExecutor } from './SlashCommandExecutor.js';
import { SlashCommandScope } from './SlashCommandScope.js';

export class SlashCommandClosure {
    /**@type {SlashCommandScope}*/ scope;
    /**@type {Boolean}*/ executeNow = false;
    // @ts-ignore
    /**@type {Object.<string,string|SlashCommandClosure>}*/ arguments = {};
    // @ts-ignore
    /**@type {Object.<string,string|SlashCommandClosure>}*/ providedArguments = {};
    /**@type {SlashCommandExecutor[]}*/ executorList = [];
    /**@type {String}*/ keptText;

    constructor(parent) {
        this.scope = new SlashCommandScope(parent);
    }

    substituteParams(text, scope = null) {
        scope = scope ?? this.scope;
        text = substituteParams(text)
            .replace(/{{pipe}}/g, scope.pipe)
            .replace(/{{var::([^\s]+?)}}/g, (_, key)=>scope.getVariable(key))
        ;
        for (const { key, value } of scope.macroList) {
            text = text.replace(new RegExp(`{{${escapeRegex(key)}}}`), value);
        }
        return text;
    }

    getCopy() {
        const closure = new SlashCommandClosure();
        closure.scope = this.scope.getCopy();
        closure.executeNow = this.executeNow;
        closure.arguments = this.arguments;
        closure.providedArguments = this.providedArguments;
        closure.executorList = this.executorList;
        closure.keptText = this.keptText;
        return closure;
    }

    /**
     *
     * @returns Promise<SlashCommandClosureResult>
     */
    async execute() {
        const closure = this.getCopy();
        return await closure.executeDirect();
    }

    async executeDirect() {
        let interrupt = false;

        // closure arguments
        for (const key of Object.keys(this.arguments)) {
            let v = this.arguments[key];
            if (v instanceof SlashCommandClosure) {
                /**@type {SlashCommandClosure}*/
                const closure = v;
                closure.scope.parent = this.scope;
                if (closure.executeNow) {
                    v = (await closure.execute())?.pipe;
                } else {
                    v = closure;
                }
            } else {
                v = this.substituteParams(v);
            }
            // unescape value
            if (typeof v == 'string') {
                v = v
                    ?.replace(/\\\|/g, '|')
                    ?.replace(/\\\{/g, '{')
                    ?.replace(/\\\}/g, '}')
                ;
            }
            this.scope.letVariable(key, v);
        }
        for (const key of Object.keys(this.providedArguments)) {
            let v = this.providedArguments[key];
            if (v instanceof SlashCommandClosure) {
                /**@type {SlashCommandClosure}*/
                const closure = v;
                closure.scope.parent = this.scope;
                if (closure.executeNow) {
                    v = (await closure.execute())?.pipe;
                } else {
                    v = closure;
                }
            } else {
                v = this.substituteParams(v, this.scope.parent);
            }
            // unescape value
            if (typeof v == 'string') {
                v = v
                    ?.replace(/\\\|/g, '|')
                    ?.replace(/\\\{/g, '{')
                    ?.replace(/\\\}/g, '}')
                ;
            }
            this.scope.setVariable(key, v);
        }

        for (const executor of this.executorList) {
            if (executor instanceof SlashCommandClosureExecutor) {
                const closure = this.scope.getVariable(executor.name);
                if (!closure || !(closure instanceof SlashCommandClosure)) throw new Error(`${executor.name} is not a closure.`);
                closure.scope.parent = this.scope;
                closure.providedArguments = executor.providedArguments;
                const result = await closure.execute();
                this.scope.pipe = result.pipe;
                interrupt = result.interrupt;
            } else {
                interrupt = executor.command.interruptsGeneration;
                let args = {
                    _scope: this.scope,
                };
                let value;
                // substitute named arguments
                for (const key of Object.keys(executor.args)) {
                    if (executor.args[key] instanceof SlashCommandClosure) {
                        /**@type {SlashCommandClosure}*/
                        const closure = executor.args[key];
                        closure.scope.parent = this.scope;
                        if (closure.executeNow) {
                            args[key] = (await closure.execute())?.pipe;
                        } else {
                            args[key] = closure;
                        }
                    } else {
                        args[key] = this.substituteParams(executor.args[key]);
                    }
                    // unescape named argument
                    if (typeof args[key] == 'string') {
                        args[key] = args[key]
                            ?.replace(/\\\|/g, '|')
                            ?.replace(/\\\{/g, '{')
                            ?.replace(/\\\}/g, '}')
                        ;
                    }
                }

                // substitute unnamed argument
                if (executor.value === undefined) {
                    if (executor.injectPipe) {
                        value = this.scope.pipe;
                    }
                } else if (executor.value instanceof SlashCommandClosure) {
                    /**@type {SlashCommandClosure}*/
                    const closure = executor.value;
                    closure.scope.parent = this.scope;
                    if (closure.executeNow) {
                        value = (await closure.execute())?.pipe;
                    } else {
                        value = closure;
                    }
                } else if (Array.isArray(executor.value)) {
                    value = [];
                    for (let i = 0; i < executor.value.length; i++) {
                        let v = executor.value[i];
                        if (v instanceof SlashCommandClosure) {
                            /**@type {SlashCommandClosure}*/
                            const closure = v;
                            closure.scope.parent = this.scope;
                            if (closure.executeNow) {
                                v = (await closure.execute())?.pipe;
                            } else {
                                v = closure;
                            }
                        } else {
                            v = this.substituteParams(v);
                        }
                        value[i] = v;
                    }
                    if (!value.find(it=>it instanceof SlashCommandClosure)) {
                        value = value.join(' ');
                    }
                } else {
                    value = this.substituteParams(executor.value);
                }
                // unescape unnamed argument
                if (typeof value == 'string') {
                    value = value
                        ?.replace(/\\\|/g, '|')
                        ?.replace(/\\\{/g, '{')
                        ?.replace(/\\\}/g, '}')
                    ;
                }

                this.scope.pipe = await executor.command.callback(args, value ?? '');
            }
        }
        /**@type {SlashCommandClosureResult} */
        const result = Object.assign(new SlashCommandClosureResult(), { interrupt, newText: this.keptText, pipe: this.scope.pipe });
        return result;
    }
}
