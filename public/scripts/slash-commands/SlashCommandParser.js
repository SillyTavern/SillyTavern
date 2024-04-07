import { SlashCommand } from './SlashCommand.js';
import { SlashCommandClosure } from './SlashCommandClosure.js';
import { SlashCommandClosureExecutor } from './SlashCommandClosureExecutor.js';
import { SlashCommandExecutor } from './SlashCommandExecutor.js';
import { SlashCommandParserError } from './SlashCommandParserError.js';
// eslint-disable-next-line no-unused-vars
import { SlashCommandScope } from './SlashCommandScope.js';

export class SlashCommandParser {
    // @ts-ignore
    /**@type {Map<String, SlashCommand>}*/ commands = {};
    // @ts-ignore
    /**@type {Map<String, String>}*/ helpStrings = {};
    /**@type {Boolean}*/ verifyCommandNames = true;
    /**@type {String}*/ text;
    /**@type {String}*/ keptText;
    /**@type {Number}*/ index;
    /**@type {SlashCommandScope}*/ scope;

    /**@type {SlashCommandExecutor[]}*/ commandIndex;

    get ahead() {
        return this.text.slice(this.index + 1);
    }
    get behind() {
        return this.text.slice(0, this.index);
    }
    get char() {
        return this.text[this.index];
    }
    get endOfText() {
        return this.index >= this.text.length || /^\s+$/.test(this.ahead);
    }


    constructor() {
        // NUMBER mode is copied from highlightjs's own implementation for JavaScript
        // https://tc39.es/ecma262/#sec-literals-numeric-literals
        const decimalDigits = '[0-9](_?[0-9])*';
        const frac = `\\.(${decimalDigits})`;
        // DecimalIntegerLiteral, including Annex B NonOctalDecimalIntegerLiteral
        // https://tc39.es/ecma262/#sec-additional-syntax-numeric-literals
        const decimalInteger = '0|[1-9](_?[0-9])*|0[0-7]*[89][0-9]*';
        const NUMBER = {
            className: 'number',
            variants: [
                // DecimalLiteral
                { begin: `(\\b(${decimalInteger})((${frac})|\\.)?|(${frac}))` +
        `[eE][+-]?(${decimalDigits})\\b` },
                { begin: `\\b(${decimalInteger})\\b((${frac})\\b|\\.)?|(${frac})\\b` },

                // DecimalBigIntegerLiteral
                { begin: '\\b(0|[1-9](_?[0-9])*)n\\b' },

                // NonDecimalIntegerLiteral
                { begin: '\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*n?\\b' },
                { begin: '\\b0[bB][0-1](_?[0-1])*n?\\b' },
                { begin: '\\b0[oO][0-7](_?[0-7])*n?\\b' },

                // LegacyOctalIntegerLiteral (does not include underscore separators)
                // https://tc39.es/ecma262/#sec-additional-syntax-numeric-literals
                { begin: '\\b0[0-7]+n?\\b' },
            ],
            relevance: 0,
        };

        const COMMAND = {
            scope: 'command',
            begin: /\/\S+/,
            beginScope: 'title.function',
            end: /\||$|:}/,
            contains: [], // defined later
        };
        const CLOSURE = {
            scope: 'closure',
            begin: /{:/,
            end: /:}/,
            contains: [], // defined later
        };
        const CLOSURE_ARGS = {
            scope: 'params',
            begin: /:}\(/,
            end: /\)/,
            contains: [],
        };
        const NAMED_ARG = {
            scope: 'type',
            begin: /\w+=/,
            end: '',
        };
        const MACRO = {
            scope: 'operator',
            begin: /{{/,
            end: /}}/,
        };
        COMMAND.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            hljs.QUOTE_STRING_MODE,
            NUMBER,
            MACRO,
            CLOSURE,
            CLOSURE_ARGS,
        );
        CLOSURE.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            hljs.QUOTE_STRING_MODE,
            NUMBER,
            MACRO,
            COMMAND,
            'self',
            CLOSURE_ARGS,
        );
        CLOSURE_ARGS.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            hljs.QUOTE_STRING_MODE,
            NUMBER,
            MACRO,
            CLOSURE,
            'self',
        );
        hljs.registerLanguage('stscript', ()=>({
            case_insensitive: false,
            keywords: ['|'],
            contains: [
                hljs.BACKSLASH_ESCAPE,
                COMMAND,
                CLOSURE,
                CLOSURE_ARGS,
            ],
        }));
    }

    addCommand(command, callback, aliases, helpString = '', interruptsGeneration = false, purgeFromMessage = true) {
        if (['/', '#'].includes(command[0])) {
            throw new Error(`Illegal Name. Slash command name cannot begin with "${command[0]}".`);
        }
        const fnObj = Object.assign(new SlashCommand(), { name:command, callback, helpString, interruptsGeneration, purgeFromMessage, aliases });

        if ([command, ...aliases].some(x => Object.hasOwn(this.commands, x))) {
            console.trace('WARN: Duplicate slash command registered!');
        }

        this.commands[command] = fnObj;

        if (Array.isArray(aliases)) {
            aliases.forEach((alias) => {
                this.commands[alias] = fnObj;
            });
        }
    }

    getHelpString() {
        const listItems = Object
            .entries(this.helpStrings)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(x => x[1])
            .map(x => `<li>${x}</li>`)
            .join('\n');
        return `<p>Slash commands:</p><ol>${listItems}</ol>
        <small>Slash commands can be batched into a single input by adding a pipe character | at the end, and then writing a new slash command.</small>
        <ul><li><small>Example:</small><code>/cut 1 | /sys Hello, | /continue</code></li>
        <li>This will remove the first message in chat, send a system message that starts with 'Hello,', and then ask the AI to continue the message.</li></ul>`;
    }

    getCommandAt(text, index) {
        try {
            this.parse(text, false);
        } catch (e) {
            // do nothing
            console.warn(e);
        }
        index += 2;
        return this.commandIndex.filter(it=>it.start <= index && (it.end >= index || it.end == null)).slice(-1)[0]
            ?? null
        ;
    }

    take(length = 1, keep = false) {
        let content = '';
        while (length-- > 0) {
            content += this.char;
            this.index++;
        }
        if (keep) this.keptText += content;
        return content;
    }
    discardWhitespace() {
        while (/\s/.test(this.char)) this.take(); // discard whitespace
    }


    parse(text, verifyCommandNames = true) {
        this.verifyCommandNames = verifyCommandNames;
        this.text = `{:${text}:}`;
        this.keptText = '';
        this.index = 0;
        this.scope = null;
        this.commandIndex = [];
        const closure = this.parseClosure();
        console.log('[STS]', closure);
        closure.keptText = this.keptText;
        return closure;
    }

    testClosure() {
        return this.ahead.length > 0 && this.char == '{' && this.ahead[0] == ':';
    }
    testClosureEnd() {
        if (this.ahead.length < 1) throw new SlashCommandParserError(`Unclosed closure at position ${this.index - 2}`, this.text, this.index);
        return this.char == ':' && this.ahead[0] == '}' && this.behind.slice(-1) != '\\';
    }
    parseClosure() {
        this.take(2); // discard opening {:
        let closure = new SlashCommandClosure(this.scope);
        this.scope = closure.scope;
        this.discardWhitespace();
        while (this.testNamedArgument()) {
            const arg = this.parseNamedArgument();
            closure.arguments[arg.key] = arg.value;
            this.discardWhitespace();
        }
        while (!this.testClosureEnd()) {
            if (this.testCommand()) {
                closure.executorList.push(this.parseCommand());
            } else {
                while (!this.testCommandEnd()) this.take(1); // discard plain text and comments
            }
            while (/\s|\|/.test(this.char)) this.take(); // discard whitespace and pipe (command separator)
        }
        this.take(2); // discard closing :}
        if (this.char == '(' && this.ahead[0] == ')') {
            this.take(2); // discard ()
            closure.executeNow = true;
        }
        this.discardWhitespace(); // discard trailing whitespace
        this.scope = closure.scope.parent;
        return closure;
    }

    testCommand() {
        return this.char == '/' && this.behind.slice(-1) != '\\' && !['/', '#'].includes(this.ahead[0]);
    }
    testCommandEnd() {
        return this.testClosureEnd() || this.endOfText || (this.char == '|' && this.behind.slice(-1) != '\\');
    }
    parseCommand() {
        const start = this.index;
        const cmd = new SlashCommandExecutor(start);
        this.take(); // discard "/"
        this.commandIndex.push(cmd);
        while (!/\s/.test(this.char) && !this.testCommandEnd()) cmd.name += this.take(); // take chars until whitespace or end
        this.discardWhitespace();
        if (this.verifyCommandNames && !this.commands[cmd.name]) throw new SlashCommandParserError(`Unknown command at position ${this.index - cmd.name.length - 2}: "/${cmd.name}"`, this.text, this.index - cmd.name.length);
        cmd.command = this.commands[cmd.name];
        while (this.testNamedArgument()) {
            const arg = this.parseNamedArgument();
            cmd.args[arg.key] = arg.value;
            this.discardWhitespace();
        }
        this.discardWhitespace();
        if (this.testUnnamedArgument()) {
            cmd.value = this.parseUnnamedArgument();
        }
        if (this.testCommandEnd()) {
            cmd.end = this.index;
            if (!cmd.command?.purgeFromMessage) this.keptText += this.text.slice(cmd.start, cmd.end);
            return cmd;
        } else {
            console.warn(this.behind, this.char, this.ahead);
            throw new SlashCommandParserError(`Unexpected end of command at position ${this.index - 2}: "/${cmd.command}"`, this.text, this.index);
        }
    }

    testNamedArgument() {
        return /^(\w+)=/.test(`${this.char}${this.ahead}`);
    }
    parseNamedArgument() {
        let key = '';
        while (/\w/.test(this.char)) key += this.take(); // take chars
        this.take(); // discard "="
        let value;
        if (this.testClosure()) {
            value = this.parseClosure();
        } else if (this.testQuotedValue()) {
            value = this.parseQuotedValue();
        } else if (this.testListValue()) {
            value = this.parseListValue();
        } else if (this.testValue()) {
            value = this.parseValue();
        }
        return { key, value };
    }

    testUnnamedArgument() {
        return !this.testCommandEnd();
    }
    testUnnamedArgumentEnd() {
        return this.testCommandEnd();
    }
    parseUnnamedArgument() {
        /**@type {SlashCommandClosure|String}*/
        let value = '';
        let isList = false;
        let listValues = [];
        while (!this.testUnnamedArgumentEnd()) {
            if (this.testClosure()) {
                isList = true;
                if (value.length > 0) {
                    listValues.push(value.trim());
                    value = '';
                }
                listValues.push(this.parseClosure());
            } else {
                value += this.take();
            }
        }
        if (isList && value.trim().length > 0) {
            listValues.push(value.trim());
        }
        if (isList) {
            if (listValues.length == 1) return listValues[0];
            return listValues;
        }
        return value.trim();
    }

    testQuotedValue() {
        return this.char == '"' && this.behind.slice(-1) != '\\';
    }
    testQuotedValueEnd() {
        if (this.endOfText) throw new SlashCommandParserError(`Unexpected end of quoted value at position ${this.index}`, this.text, this.index);
        return this.char == '"' && this.behind.slice(-1) != '\\';
    }
    parseQuotedValue() {
        this.take(); // discard opening quote
        let value = '';
        while (!this.testQuotedValueEnd()) value += this.take(); // take all chars until closing quote
        this.take(); // discard closing quote
        return value;
    }

    testListValue() {
        return this.char == '[' && this.behind.slice(-1) != '\\';
    }
    testListValueEnd() {
        if (this.endOfText) throw new SlashCommandParserError(`Unexpected end of list value at position ${this.index}`, this.text, this.index);
        return this.char == ']' && this.behind.slice(-1) != '\\';
    }
    parseListValue() {
        let value = '';
        while (!this.testListValueEnd()) value += this.take(); // take all chars until closing bracket
        value += this.take(); // take closing bracket
        return value;
    }

    testValue() {
        return !/\s/.test(this.char);
    }
    testValueEnd() {
        if (/\s/.test(this.char)) return true;
        return this.testCommandEnd();
    }
    parseValue() {
        let value = '';
        while (!this.testValueEnd()) value += this.take(); // take all chars until value end
        return value;
    }
}
