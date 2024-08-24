import { substituteParams } from '../../script.js';
import { delay, escapeRegex, uuidv4 } from '../utils.js';
import { SlashCommand } from './SlashCommand.js';
import { SlashCommandAbortController } from './SlashCommandAbortController.js';
import { SlashCommandBreak } from './SlashCommandBreak.js';
import { SlashCommandBreakController } from './SlashCommandBreakController.js';
import { SlashCommandBreakPoint } from './SlashCommandBreakPoint.js';
import { SlashCommandClosureResult } from './SlashCommandClosureResult.js';
import { SlashCommandDebugController } from './SlashCommandDebugController.js';
import { SlashCommandExecutionError } from './SlashCommandExecutionError.js';
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
    /**@type {SlashCommandBreakController}*/ breakController;
    /**@type {SlashCommandDebugController}*/ debugController;
    /**@type {(done:number, total:number)=>void}*/ onProgress;
    /**@type {string}*/ rawText;
    /**@type {string}*/ fullText;
    /**@type {string}*/ parserContext;
    /**@type {string}*/ #source = uuidv4();
    get source() { return this.#source; }
    set source(value) {
        this.#source = value;
        for (const executor of this.executorList) {
            executor.source = value;
        }
    }

    /**@type {number}*/
    get commandCount() {
        return this.executorList.map(executor=>executor.commandCount).reduce((sum,cur)=>sum + cur, 0);
    }

    constructor(parent) {
        this.scope = new SlashCommandScope(parent);
    }

    toString() {
        return `[Closure]${this.executeNow ? '()' : ''}`;
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
        const escapeMacro = (it, isAnchored = false)=>{
            const regexText = escapeRegex(it.key.replace(/\*/g, '~~~WILDCARD~~~'))
                .replaceAll('~~~WILDCARD~~~', '(?:(?:(?!(?:::|}})).)*)')
            ;
            if (isAnchored) {
                return `^${regexText}$`;
            }
            return regexText;
        };
        const macroList = scope.macroList.toSorted((a,b)=>{
            if (a.key.includes('*') && !b.key.includes('*')) return 1;
            if (!a.key.includes('*') && b.key.includes('*')) return -1;
            if (a.key.includes('*') && b.key.includes('*')) return b.key.indexOf('*') - a.key.indexOf('*');
            return 0;
        });
        const macros = macroList.map(it=>escapeMacro(it)).join('|');
        const re = new RegExp(`(?<pipe>{{pipe}})|(?:{{var::(?<var>[^\\s]+?)(?:::(?<varIndex>(?!}}).+))?}})|(?:{{(?<macro>${macros})}})`);
        let done = '';
        let remaining = text;
        while (re.test(remaining)) {
            const match = re.exec(remaining);
            const before = substituteParams(remaining.slice(0, match.index));
            const after = remaining.slice(match.index + match[0].length);
            const replacer = match.groups.pipe ? scope.pipe : match.groups.var ? scope.getVariable(match.groups.var, match.groups.index) : macroList.find(it=>it.key == match.groups.macro || new RegExp(escapeMacro(it, true)).test(match.groups.macro))?.value;
            if (replacer instanceof SlashCommandClosure) {
                replacer.abortController = this.abortController;
                replacer.breakController = this.breakController;
                replacer.scope.parent = this.scope;
                if (this.debugController && !replacer.debugController) {
                    replacer.debugController = this.debugController;
                }
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
        closure.breakController = this.breakController;
        closure.debugController = this.debugController;
        closure.rawText = this.rawText;
        closure.fullText = this.fullText;
        closure.parserContext = this.parserContext;
        closure.source = this.source;
        closure.onProgress = this.onProgress;
        return closure;
    }

    /**
     *
     * @returns {Promise<SlashCommandClosureResult>}
     */
    async execute() {
        // execute a copy of the closure to no taint it and its scope with the effects of its execution
        // as this would affect the closure being called a second time (e.g., loop, multiple /run calls)
        const closure = this.getCopy();
        const gen = closure.executeDirect();
        let step;
        while (!step?.done) {
            step = await gen.next(this.debugController?.testStepping(this) ?? false);
            if (!(step.value instanceof SlashCommandClosureResult) && this.debugController) {
                this.debugController.isStepping = await this.debugController.awaitBreakPoint(step.value.closure, step.value.executor);
            }
        }
        return step.value;
    }

    async * executeDirect() {
        this.debugController?.down(this);
        // closure arguments
        for (const arg of this.argumentList) {
            let v = arg.value;
            if (v instanceof SlashCommandClosure) {
                /**@type {SlashCommandClosure}*/
                const closure = v;
                closure.scope.parent = this.scope;
                closure.breakController = this.breakController;
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
                closure.breakController = this.breakController;
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

        if (this.executorList.length == 0) {
            this.scope.pipe = '';
        }
        const stepper = this.executeStep();
        let step;
        while (!step?.done && !this.breakController?.isBreak) {
            // get executor before execution
            step = await stepper.next();
            if (step.value instanceof SlashCommandBreakPoint) {
                console.log('encountered SlashCommandBreakPoint');
                if (this.debugController) {
                    // resolve args
                    step = await stepper.next();
                    // "execute" breakpoint
                    step = await stepper.next();
                    // get next executor
                    step = await stepper.next();
                    // breakpoint has to yield before arguments are resolved if one of the
                    // arguments is an immediate closure, otherwise you cannot step into the
                    // immediate closure
                    const hasImmediateClosureInNamedArgs = /**@type {SlashCommandExecutor}*/(step.value)?.namedArgumentList?.find(it=>it.value instanceof SlashCommandClosure && it.value.executeNow);
                    const hasImmediateClosureInUnnamedArgs = /**@type {SlashCommandExecutor}*/(step.value)?.unnamedArgumentList?.find(it=>it.value instanceof SlashCommandClosure && it.value.executeNow);
                    if (hasImmediateClosureInNamedArgs || hasImmediateClosureInUnnamedArgs) {
                        this.debugController.isStepping = yield { closure:this, executor:step.value };
                    } else {
                        this.debugController.isStepping = true;
                        this.debugController.stepStack[this.debugController.stepStack.length - 1] = true;
                    }
                }
            } else if (!step.done && this.debugController?.testStepping(this)) {
                this.debugController.isSteppingInto = false;
                // if stepping, have to yield before arguments are resolved if one of the arguments
                // is an immediate closure, otherwise you cannot step into the immediate closure
                const hasImmediateClosureInNamedArgs = /**@type {SlashCommandExecutor}*/(step.value)?.namedArgumentList?.find(it=>it.value instanceof SlashCommandClosure && it.value.executeNow);
                const hasImmediateClosureInUnnamedArgs = /**@type {SlashCommandExecutor}*/(step.value)?.unnamedArgumentList?.find(it=>it.value instanceof SlashCommandClosure && it.value.executeNow);
                if (hasImmediateClosureInNamedArgs || hasImmediateClosureInUnnamedArgs) {
                    this.debugController.isStepping = yield { closure:this, executor:step.value };
                }
            }
            // resolve args
            step = await stepper.next();
            if (step.value instanceof SlashCommandBreak) {
                console.log('encountered SlashCommandBreak');
                if (this.breakController) {
                    this.breakController?.break();
                    break;
                }
            } else if (!step.done && this.debugController?.testStepping(this)) {
                this.debugController.isSteppingInto = false;
                this.debugController.isStepping = yield { closure:this, executor:step.value };
            }
            // execute executor
            step = await stepper.next();
        }

        // if execution has returned a closure result, return that (should only happen on abort)
        if (step.value instanceof SlashCommandClosureResult) {
            this.debugController?.up();
            return step.value;
        }
        /**@type {SlashCommandClosureResult} */
        const result = Object.assign(new SlashCommandClosureResult(), { pipe: this.scope.pipe, isBreak: this.breakController?.isBreak ?? false });
        this.debugController?.up();
        return result;
    }
    /**
     * Generator that steps through the executor list.
     * Every executor is split into three steps:
     *  - before arguments are resolved
     *  - after arguments are resolved
     *  - after execution
     */
    async * executeStep() {
        let done = 0;
        let isFirst = true;
        for (const executor of this.executorList) {
            this.onProgress?.(done, this.commandCount);
            if (this.debugController) {
                this.debugController.setExecutor(executor);
                this.debugController.namedArguments = undefined;
                this.debugController.unnamedArguments = undefined;
            }
            // yield before doing anything with this executor, the debugger might want to do
            // something with it (e.g., breakpoint, immediate closures that need resolving
            // or stepping into)
            yield executor;
            /**@type {import('./SlashCommand.js').NamedArguments} */
            // @ts-ignore
            let args = {
                _scope: this.scope,
                _parserFlags: executor.parserFlags,
                _abortController: this.abortController,
                _debugController: this.debugController,
                _hasUnnamedArgument: executor.unnamedArgumentList.length > 0,
            };
            if (executor instanceof SlashCommandBreakPoint) {
                // nothing to do for breakpoints, just raise counter and yield for "before exec"
                done++;
                yield executor;
                isFirst = false;
            } else if (executor instanceof SlashCommandBreak) {
                // /break need to resolve the unnamed arg and put it into pipe, then yield
                // for "before exec"
                const value = await this.substituteUnnamedArgument(executor, isFirst, args);
                done += this.executorList.length - this.executorList.indexOf(executor);
                this.scope.pipe = value ?? this.scope.pipe;
                yield executor;
                isFirst = false;
            } else {
                // regular commands do all the argument resolving logic...
                await this.substituteNamedArguments(executor, args);
                let value = await this.substituteUnnamedArgument(executor, isFirst, args);

                let abortResult = await this.testAbortController();
                if (abortResult) {
                    return abortResult;
                }
                if (this.debugController) {
                    this.debugController.namedArguments = args;
                    this.debugController.unnamedArguments = value ?? '';
                }
                // then yield for "before exec"
                yield executor;
                // followed by command execution
                executor.onProgress = (subDone, subTotal)=>this.onProgress?.(done + subDone, this.commandCount);
                const isStepping = this.debugController?.testStepping(this);
                if (this.debugController) {
                    this.debugController.isStepping = false || this.debugController.isSteppingInto;
                }
                try {
                    this.scope.pipe = await executor.command.callback(args, value ?? '');
                } catch (ex) {
                    throw new SlashCommandExecutionError(ex, ex.message, executor.name, executor.start, executor.end, this.fullText.slice(executor.start, executor.end), this.fullText);
                }
                if (this.debugController) {
                    this.debugController.namedArguments = undefined;
                    this.debugController.unnamedArguments = undefined;
                    this.debugController.isStepping = isStepping;
                }
                this.#lintPipe(executor.command);
                done += executor.commandCount;
                this.onProgress?.(done, this.commandCount);
                abortResult = await this.testAbortController();
                if (abortResult) {
                    return abortResult;
                }
            }
            // finally, yield for "after exec"
            yield executor;
            isFirst = false;
        }
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
     * @param {SlashCommandExecutor} executor
     * @param {import('./SlashCommand.js').NamedArguments} args
     */
    async substituteNamedArguments(executor, args) {
        // substitute named arguments
        for (const arg of executor.namedArgumentList) {
            if (arg.value instanceof SlashCommandClosure) {
                /**@type {SlashCommandClosure}*/
                const closure = arg.value;
                closure.scope.parent = this.scope;
                closure.breakController = this.breakController;
                if (this.debugController && !closure.debugController) {
                    closure.debugController = this.debugController;
                }
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
    }

    /**
     * @param {SlashCommandExecutor} executor
     * @param {boolean} isFirst
     * @param {import('./SlashCommand.js').NamedArguments} args
     * @returns {Promise<string|SlashCommandClosure|(string|SlashCommandClosure)[]>}
     */
    async substituteUnnamedArgument(executor, isFirst, args) {
        let value;
        // substitute unnamed argument
        if (executor.unnamedArgumentList.length == 0) {
            if (!isFirst && executor.injectPipe) {
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
                    closure.breakController = this.breakController;
                    if (this.debugController && !closure.debugController) {
                        closure.debugController = this.debugController;
                    }
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
        return value;
    }

    /**
     * Auto-fixes the pipe if it is not a valid result for STscript.
     * @param {SlashCommand} command Command being executed
     */
    #lintPipe(command) {
        if (this.scope.pipe === undefined || this.scope.pipe === null) {
            console.warn(`/${command.name} returned undefined or null. Auto-fixing to empty string.`);
            this.scope.pipe = '';
        } else if (!(typeof this.scope.pipe == 'string' || this.scope.pipe instanceof SlashCommandClosure)) {
            console.warn(`/${command.name} returned illegal type (${typeof this.scope.pipe} - ${this.scope.pipe.constructor?.name ?? ''}). Auto-fixing to stringified JSON.`);
            this.scope.pipe = JSON.stringify(this.scope.pipe) ?? '';
        }
    }
}
