import { substituteParams } from '../../script.js';
import { delay, escapeRegex } from '../utils.js';
import { SlashCommand } from './SlashCommand.js';
import { SlashCommandAbortController } from './SlashCommandAbortController.js';
import { SlashCommandClosureExecutor } from './SlashCommandClosureExecutor.js';
import { SlashCommandClosureResult } from './SlashCommandClosureResult.js';
import { SlashCommandExecutor } from './SlashCommandExecutor.js';
import { SlashCommandNamedArgumentAssignment } from './SlashCommandNamedArgumentAssignment.js';
import { SlashCommandScope } from './SlashCommandScope.js';

export class SlashCommandClosure {
    /**@type {SlashCommandScope}*/ scope;
    /**@type {boolean}*/ executeNow = false;
    // @ts-ignore
    /**@type {SlashCommandNamedArgumentAssignment[]}*/ argumentList = [];
    // @ts-ignore
    /**@type {SlashCommandNamedArgumentAssignment[]}*/ providedArgumentList = [];
    /**@type {SlashCommandExecutor[]}*/ executorList = [];
    /**@type {SlashCommandAbortController}*/ abortController;
    /**@type {(done:number, total:number)=>void}*/ onProgress;
    /**@type {string}*/ rawText;

    /**@type {number}*/
    get commandCount() {
        return this.executorList.map(executor=>executor.commandCount).reduce((sum,cur)=>sum + cur, 0);
    }

    constructor(parent) {
        this.scope = new SlashCommandScope(parent);
    }

    toString() {
        return '[Closure]';
    }

    /**
     *
     * @param {string} text
     * @param {SlashCommandScope} scope
     * @returns
     */
    substituteParams(text, scope = null) {
        let isList = false;
        let listValues = [];
        scope = scope ?? this.scope;
        const macros = scope.macroList.map(it=>escapeRegex(it.key)).join('|');
        const re = new RegExp(`({{pipe}})|(?:{{var::([^\\s]+?)(?:::((?!}}).+))?}})|(?:{{(${macros})}})`);
        let done = '';
        let remaining = text;
        while (re.test(remaining)) {
            const match = re.exec(remaining);
            const before = substituteParams(remaining.slice(0, match.index));
            const after = remaining.slice(match.index + match[0].length);
            const replacer = match[1] ? scope.pipe : match[2] ? scope.getVariable(match[2], match[3]) : scope.macroList.find(it=>it.key == match[4])?.value;
            if (replacer instanceof SlashCommandClosure) {
                isList = true;
                if (match.index > 0) {
                    listValues.push(before);
                }
                listValues.push(replacer);
                if (match.index + match[0].length + 1 < remaining.length) {
                    const rest = this.substituteParams(after, scope);
                    listValues.push(...(Array.isArray(rest) ? rest : [rest]));
                }
                break;
            } else {
                done = `${done}${before}${replacer}`;
                remaining = after;
            }
        }
        if (!isList) {
            text = `${done}${substituteParams(remaining)}`;
        }

        if (isList) {
            if (listValues.length > 1) return listValues;
            return listValues[0];
        }
        return text;
    }

    getCopy() {
        const closure = new SlashCommandClosure();
        closure.scope = this.scope.getCopy();
        closure.executeNow = this.executeNow;
        closure.argumentList = this.argumentList;
        closure.providedArgumentList = this.providedArgumentList;
        closure.executorList = this.executorList;
        closure.abortController = this.abortController;
        closure.onProgress = this.onProgress;
        return closure;
    }

    /**
     *
     * @returns {Promise<SlashCommandClosureResult>}
     */
    async execute() {
        const closure = this.getCopy();
        return await closure.executeDirect();
    }

    async executeDirect() {
        // closure arguments
        for (const arg of this.argumentList) {
            let v = arg.value;
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
                    ?.replace(/\\\{/g, '{')
                    ?.replace(/\\\}/g, '}')
                ;
            }
            this.scope.letVariable(arg.name, v);
        }
        for (const arg of this.providedArgumentList) {
            let v = arg.value;
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
                    ?.replace(/\\\{/g, '{')
                    ?.replace(/\\\}/g, '}')
                ;
            }
            this.scope.setVariable(arg.name, v);
        }

        let done = 0;
        if (this.executorList.length == 0) {
            this.scope.pipe = '';
        }
        for (const executor of this.executorList) {
            this.onProgress?.(done, this.commandCount);
            if (executor instanceof SlashCommandClosureExecutor) {
                const closure = this.scope.getVariable(executor.name);
                if (!closure || !(closure instanceof SlashCommandClosure)) throw new Error(`${executor.name} is not a closure.`);
                closure.scope.parent = this.scope;
                closure.providedArgumentList = executor.providedArgumentList;
                const result = await closure.execute();
                this.scope.pipe = result.pipe;
            } else {
                /**@type {import('./SlashCommand.js').NamedArguments} */
                let args = {
                    _scope: this.scope,
                    _parserFlags: executor.parserFlags,
                    _abortController: this.abortController,
                    _hasUnnamedArgument: executor.unnamedArgumentList.length > 0,
                };
                let value;
                // substitute named arguments
                for (const arg of executor.namedArgumentList) {
                    if (arg.value instanceof SlashCommandClosure) {
                        /**@type {SlashCommandClosure}*/
                        const closure = arg.value;
                        closure.scope.parent = this.scope;
                        if (closure.executeNow) {
                            args[arg.name] = (await closure.execute())?.pipe;
                        } else {
                            args[arg.name] = closure;
                        }
                    } else {
                        args[arg.name] = this.substituteParams(arg.value);
                    }
                    // unescape named argument
                    if (typeof args[arg.name] == 'string') {
                        args[arg.name] = args[arg.name]
                            ?.replace(/\\\{/g, '{')
                            ?.replace(/\\\}/g, '}')
                        ;
                    }
                }

                // substitute unnamed argument
                if (executor.unnamedArgumentList.length == 0) {
                    if (executor.injectPipe) {
                        value = this.scope.pipe;
                        args._hasUnnamedArgument = this.scope.pipe !== null && this.scope.pipe !== undefined;
                    }
                } else {
                    value = [];
                    for (let i = 0; i < executor.unnamedArgumentList.length; i++) {
                        let v = executor.unnamedArgumentList[i].value;
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
                    if (!executor.command.splitUnnamedArgument) {
                        if (value.length == 1) {
                            value = value[0];
                        } else if (!value.find(it=>it instanceof SlashCommandClosure)) {
                            value = value.join('');
                        }
                    }
                }
                // unescape unnamed argument
                if (typeof value == 'string') {
                    value = value
                        ?.replace(/\\\{/g, '{')
                        ?.replace(/\\\}/g, '}')
                    ;
                } else if (Array.isArray(value)) {
                    value = value.map(v=>{
                        if (typeof v == 'string') {
                            return v
                                ?.replace(/\\\{/g, '{')
                                ?.replace(/\\\}/g, '}');
                        }
                        return v;
                    });
                }

                let abortResult = await this.testAbortController();
                if (abortResult) {
                    return abortResult;
                }
                executor.onProgress = (subDone, subTotal)=>this.onProgress?.(done + subDone, this.commandCount);
                this.scope.pipe = await executor.command.callback(args, value ?? '');
                this.#lintPipe(executor.command);
                done += executor.commandCount;
                this.onProgress?.(done, this.commandCount);
                abortResult = await this.testAbortController();
                if (abortResult) {
                    return abortResult;
                }
            }
        }
        /**@type {SlashCommandClosureResult} */
        const result = Object.assign(new SlashCommandClosureResult(), { pipe: this.scope.pipe });
        return result;
    }

    async testPaused() {
        while (!this.abortController?.signal?.aborted && this.abortController?.signal?.paused) {
            await delay(200);
        }
    }
    async testAbortController() {
        await this.testPaused();
        if (this.abortController?.signal?.aborted) {
            const result = new SlashCommandClosureResult();
            result.isAborted = true;
            result.isQuietlyAborted = this.abortController.signal.isQuiet;
            result.abortReason = this.abortController.signal.reason.toString();
            return result;
        }
    }

    /**
     * Auto-fixes the pipe if it is not a valid result for STscript.
     * @param {SlashCommand} command Command being executed
     */
    #lintPipe(command) {
        if (this.scope.pipe === undefined || this.scope.pipe === null) {
            console.warn(`${command.name} returned undefined or null. Auto-fixing to empty string.`);
            this.scope.pipe = '';
        }
    }
}
