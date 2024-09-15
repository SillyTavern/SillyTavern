import { SlashCommandClosure } from './SlashCommandClosure.js';
import { convertValueType } from '../utils.js';

export class SlashCommandScope {
    /**@type {string[]}*/ variableNames = [];
    get allVariableNames() {
        const names = [...this.variableNames, ...(this.parent?.allVariableNames ?? [])];
        return names.filter((it,idx)=>idx == names.indexOf(it));
    }
    // @ts-ignore
    /**@type {object.<string, string|SlashCommandClosure>}*/ variables = {};
    // @ts-ignore
    /**@type {object.<string, string|SlashCommandClosure>}*/ macros = {};
    /**@type {{key:string, value:string|SlashCommandClosure}[]} */
    get macroList() {
        return [...Object.keys(this.macros).map(key=>({ key, value:this.macros[key] })), ...(this.parent?.macroList ?? [])];
    }
    /**@type {SlashCommandScope}*/ parent;
    /**@type {string}*/ #pipe;
    get pipe() {
        return this.#pipe ?? this.parent?.pipe;
    }
    set pipe(value) {
        this.#pipe = value;
    }


    constructor(parent) {
        this.parent = parent;
    }

    getCopy() {
        const scope = new SlashCommandScope(this.parent);
        scope.variableNames = [...this.variableNames];
        scope.variables = Object.assign({}, this.variables);
        scope.macros = Object.assign({}, this.macros);
        scope.#pipe = this.#pipe;
        return scope;
    }


    setMacro(key, value, overwrite = true) {
        if (overwrite || !this.macroList.find(it=>it.key == key)) {
            this.macros[key] = value;
        }
    }


    existsVariableInScope(key) {
        return Object.keys(this.variables).includes(key);
    }
    existsVariable(key) {
        return Object.keys(this.variables).includes(key) || this.parent?.existsVariable(key);
    }
    letVariable(key, value = undefined) {
        if (this.existsVariableInScope(key)) throw new SlashCommandScopeVariableExistsError(`Variable named "${key}" already exists.`);
        this.variables[key] = value;
    }
    setVariable(key, value, index = null, type = null) {
        if (this.existsVariableInScope(key)) {
            if (index !== null && index !== undefined) {
                let v = this.variables[key];
                try {
                    v = JSON.parse(v);
                    const numIndex = Number(index);
                    if (Number.isNaN(numIndex)) {
                        v[index] = convertValueType(value, type);
                    } else {
                        v[numIndex] = convertValueType(value, type);
                    }
                    v = JSON.stringify(v);
                } catch {
                    v[index] = convertValueType(value, type);
                }
                this.variables[key] = v;
            } else {
                this.variables[key] = value;
            }
            return value;
        }
        if (this.parent) {
            return this.parent.setVariable(key, value, index, type);
        }
        throw new SlashCommandScopeVariableNotFoundError(`No such variable: "${key}"`);
    }
    getVariable(key, index = null) {
        if (this.existsVariableInScope(key)) {
            if (index !== null && index !== undefined) {
                let v = this.variables[key];
                try { v = JSON.parse(v); } catch { /* empty */ }
                const numIndex = Number(index);
                if (Number.isNaN(numIndex)) {
                    v = v[index];
                } else {
                    v = v[numIndex];
                }
                if (typeof v == 'object') return JSON.stringify(v);
                return v ?? '';
            } else {
                const value = this.variables[key];
                return (value?.trim?.() === '' || isNaN(Number(value))) ? (value || '') : Number(value);
            }
        }
        if (this.parent) {
            return this.parent.getVariable(key, index);
        }
        throw new SlashCommandScopeVariableNotFoundError(`No such variable: "${key}"`);
    }
}




export class SlashCommandScopeVariableExistsError extends Error {}


export class SlashCommandScopeVariableNotFoundError extends Error {}
