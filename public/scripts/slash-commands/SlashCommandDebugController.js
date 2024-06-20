import { SlashCommandClosure } from './SlashCommandClosure.js';
import { SlashCommandExecutor } from './SlashCommandExecutor.js';

export class SlashCommandDebugController {
    /**@type {SlashCommandClosure[]} */ stack = [];
    /**@type {boolean} */ isStepping = false;
    /**@type {boolean} */ isSteppingInto = false;

    /**@type {Promise<boolean>} */ continuePromise;
    /**@type {(boolean)=>void} */ continueResolver;

    /**@type {(closure:SlashCommandClosure, executor:SlashCommandExecutor)=>Promise<boolean>} */ onBreakPoint;




    down(closure) {
        this.stack.push(closure);
    }
    up() {
        this.stack.pop();
    }



    resume() {
        this.continueResolver?.(false);
        this.continuePromise = null;
    }
    step() {
        this.continueResolver?.(true);
        this.continuePromise = null;
    }
    stepInto() {
        this.isSteppingInto = true;
        this.continueResolver?.(true);
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
