import { SlashCommandClosure } from './SlashCommandClosure.js';
import { SlashCommandExecutor } from './SlashCommandExecutor.js';

export class SlashCommandDebugController {
    /**@type {SlashCommandClosure[]} */ stack = [];
    /**@type {SlashCommandExecutor[]} */ cmdStack = [];
    /**@type {boolean[]} */ stepStack = [];
    /**@type {boolean} */ isStepping = false;
    /**@type {boolean} */ isSteppingInto = false;
    /**@type {boolean} */ isSteppingOut = false;

    /**@type {object} */ namedArguments;
    /**@type {string|SlashCommandClosure|(string|SlashCommandClosure)[]} */ unnamedArguments;

    /**@type {Promise<boolean>} */ continuePromise;
    /**@type {(boolean)=>void} */ continueResolver;

    /**@type {(closure:SlashCommandClosure, executor:SlashCommandExecutor)=>Promise<boolean>} */ onBreakPoint;




    testStepping(closure) {
        return this.stepStack[this.stack.indexOf(closure)];
    }




    down(closure) {
        this.stack.push(closure);
        if (this.stepStack.length < this.stack.length) {
            this.stepStack.push(this.isSteppingInto);
        }
    }
    up() {
        this.stack.pop();
        while (this.cmdStack.length > this.stack.length) this.cmdStack.pop();
        this.stepStack.pop();
    }

    setExecutor(executor) {
        this.cmdStack[this.stack.length - 1] = executor;
    }



    resume() {
        this.continueResolver?.(false);
        this.continuePromise = null;
        this.stepStack.forEach((_,idx)=>this.stepStack[idx] = false);
    }
    step() {
        this.stepStack.forEach((_,idx)=>this.stepStack[idx] = true);
        this.continueResolver?.(true);
        this.continuePromise = null;
    }
    stepInto() {
        this.isSteppingInto = true;
        this.stepStack.forEach((_,idx)=>this.stepStack[idx] = true);
        this.continueResolver?.(true);
        this.continuePromise = null;
    }
    stepOut() {
        this.isSteppingOut = true;
        this.stepStack[this.stepStack.length - 1] = false;
        this.continueResolver?.(false);
        this.continuePromise = null;
    }

    async awaitContinue() {
        this.continuePromise ??= new Promise(resolve=>{
            this.continueResolver = resolve;
        });
        this.isStepping = await this.continuePromise;
        return this.isStepping;
    }

    async awaitBreakPoint(closure, executor) {
        this.isStepping = await this.onBreakPoint(closure, executor);
        return this.isStepping;
    }
}
