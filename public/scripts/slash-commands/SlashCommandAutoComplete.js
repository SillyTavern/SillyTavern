import { power_user } from '../power-user.js';
import { debounce, escapeRegex } from '../utils.js';
import { OPTION_TYPE, SlashCommandAutoCompleteOption, SlashCommandFuzzyScore } from './SlashCommandAutoCompleteOption.js';
import { SlashCommandParser } from './SlashCommandParser.js';
// eslint-disable-next-line no-unused-vars
import { NAME_RESULT_TYPE, SlashCommandParserNameResult } from './SlashCommandParserNameResult.js';

export class SlashCommandAutoComplete {
    /**@type {HTMLTextAreaElement}*/ textarea;
    /**@type {boolean}*/ isFloating = false;

    /**@type {SlashCommandParser}*/ parser;

    /**@type {boolean}*/ isActive = false;
    /**@type {boolean}*/ isReplaceable = false;
    /**@type {boolean}*/ isShowingDetails = false;

    /**@type {string}*/ text;
    /**@type {SlashCommandParserNameResult}*/ parserResult;
    /**@type {string}*/ slashCommand;

    /**@type {boolean}*/ startQuote;
    /**@type {boolean}*/ endQuote;
    /**@type {number}*/ selectionStart;

    /**@type {RegExp}*/ fuzzyRegex;


    /**@type {Object.<string,HTMLElement>}*/ items = {};
    /**@type {boolean}*/ hasCache = false;

    /**@type {SlashCommandAutoCompleteOption[]}*/ result = [];
    /**@type {SlashCommandAutoCompleteOption}*/ selectedItem = null;

    /**@type {Promise}*/ pointerup = Promise.resolve();

    /**@type {HTMLElement}*/ clone;
    /**@type {HTMLElement}*/ domWrap;
    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ detailsWrap;
    /**@type {HTMLElement}*/ detailsDom;

    /**@type {function}*/ renderDebounced;
    /**@type {function}*/ renderDetailsDebounced;
    /**@type {function}*/ updatePositionDebounced;
    /**@type {function}*/ updateDetailsPositionDebounced;
    /**@type {function}*/ updateFloatingPositionDebounced;

    get matchType() {
        return power_user.stscript.matching ?? 'fuzzy';
    }




    /**
     * @param {HTMLTextAreaElement} textarea The textarea to receive autocomplete.
     * @param {boolean} isFloating Whether autocomplete should float at the keyboard cursor.
     */
    constructor(textarea, isFloating = false) {
        this.textarea = textarea;
        this.isFloating = isFloating;

        this.parser = new SlashCommandParser();

        this.domWrap = document.createElement('div'); {
            this.domWrap.classList.add('slashCommandAutoComplete-wrap');
            if (isFloating) this.domWrap.classList.add('isFloating');
        }
        this.dom = document.createElement('ul'); {
            this.dom.classList.add('slashCommandAutoComplete');
            this.domWrap.append(this.dom);
        }
        this.detailsWrap = document.createElement('div'); {
            this.detailsWrap.classList.add('slashCommandAutoComplete-detailsWrap');
            if (isFloating) this.detailsWrap.classList.add('isFloating');
        }
        this.detailsDom = document.createElement('div'); {
            this.detailsDom.classList.add('slashCommandAutoComplete-details');
            this.detailsWrap.append(this.detailsDom);
        }

        this.renderDebounced = debounce(this.render.bind(this), 10);
        this.renderDetailsDebounced = debounce(this.renderDetails.bind(this), 10);
        this.updatePositionDebounced = debounce(this.updatePosition.bind(this), 10);
        this.updateDetailsPositionDebounced = debounce(this.updateDetailsPosition.bind(this), 10);
        this.updateFloatingPositionDebounced = debounce(this.updateFloatingPosition.bind(this), 10);

        textarea.addEventListener('input', ()=>this.show(true));
        textarea.addEventListener('keydown', (evt)=>this.handleKeyDown(evt));
        textarea.addEventListener('click', ()=>this.isActive ? this.show() : null);
        textarea.addEventListener('selectionchange', ()=>this.show());
        // textarea.addEventListener('blur', ()=>this.hide());
        if (isFloating) {
            textarea.addEventListener('scroll', ()=>this.updateFloatingPositionDebounced());
        }
        window.addEventListener('resize', ()=>this.updatePositionDebounced());
    }


    /**
     * Build a cache of DOM list items for autocomplete of slash commands.
     */
    buildCache() {
        if (!this.hasCache) {
            this.hasCache = true;
            // init by appending all command options
            Object.keys(this.parser.commands).forEach(key=>{
                const cmd = this.parser.commands[key];
                this.items[key] = this.makeItem(
                    key,
                    '/',
                    false,
                    cmd.namedArgumentList,
                    cmd.unnamedArgumentList,
                    cmd.returns,
                    cmd.helpString,
                    [cmd.name, ...(cmd.aliases ?? [])].filter(it=>it != key),
                );
            });
        }
    }

    makeItem(key, typeIcon, noSlash, namedArguments = [], unnamedArguments = [], returnType = 'void', helpString = '', aliasList = []) {
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
                    name.textContent = noSlash ? '' : '/';
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
                        for (const arg of namedArguments) {
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
                        for (const arg of unnamedArguments) {
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
                        returns.textContent = returnType ?? 'void';
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
                    content.innerHTML = helpString;
                    const text = content.textContent;
                    content.innerHTML = '';
                    content.textContent = text;
                    help.append(content);
                }
                li.append(help);
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
                    // li.append(aliases);
                }
            }
            // gotta listen to pointerdown (happens before textarea-blur)
            li.addEventListener('pointerdown', ()=>{
                // gotta catch pointerup to restore focus to textarea (blurs after pointerdown)
                this.pointerup = new Promise(resolve=>{
                    const resolver = ()=>{
                        window.removeEventListener('pointerup', resolver);
                        resolve();
                    };
                    window.addEventListener('pointerup', resolver);
                });
                this.select();
            });
        }
        return li;
    }


    /**
     *
     * @param {SlashCommandAutoCompleteOption} item
     */
    updateName(item) {
        const chars = Array.from(item.dom.querySelector('.name').children);
        switch (this.matchType) {
            case 'strict': {
                chars.forEach((it, idx)=>{
                    if (idx < item.name.length) {
                        it.classList.add('matched');
                    } else {
                        it.classList.remove('matched');
                    }
                });
                break;
            }
            case 'includes': {
                const start = item.name.toLowerCase().search(this.slashCommand);
                chars.forEach((it, idx)=>{
                    if (idx < start) {
                        it.classList.remove('matched');
                    } else if (idx < start + item.name.length) {
                        it.classList.add('matched');
                    } else {
                        it.classList.remove('matched');
                    }
                });
                break;
            }
            case 'fuzzy': {
                item.name.replace(this.fuzzyRegex, (_, ...parts)=>{
                    parts.splice(-2, 2);
                    if (parts.length == 2) {
                        chars.forEach(c=>c.classList.remove('matched'));
                    } else {
                        let cIdx = 0;
                        parts.forEach((it, idx)=>{
                            if (it === null || it.length == 0) return '';
                            if (idx % 2 == 1) {
                                chars.slice(cIdx, cIdx + it.length).forEach(c=>c.classList.add('matched'));
                            } else {
                                chars.slice(cIdx, cIdx + it.length).forEach(c=>c.classList.remove('matched'));
                            }
                            cIdx += it.length;
                        });
                    }
                    return '';
                });
            }
        }
        return item;
    }

    /**
     * Calculate score for the fuzzy match.
     * @param {SlashCommandAutoCompleteOption} option
     * @returns The option.
     */
    fuzzyScore(option) {
        const parts = this.fuzzyRegex.exec(option.name).slice(1, -1);
        let start = null;
        let consecutive = [];
        let current = '';
        let offset = 0;
        parts.forEach((part, idx) => {
            if (idx % 2 == 0) {
                if (part.length > 0) {
                    if (current.length > 0) {
                        consecutive.push(current);
                    }
                    current = '';
                }
            } else {
                if (start === null) {
                    start = offset;
                }
                current += part;
            }
            offset += part.length;
        });
        if (current.length > 0) {
            consecutive.push(current);
        }
        consecutive.sort((a,b)=>b.length - a.length);
        option.score = new SlashCommandFuzzyScore(start, consecutive[0]?.length ?? 0);
        return option;
    }

    /**
     * Compare two auto complete options by their fuzzy score.
     * @param {SlashCommandAutoCompleteOption} a
     * @param {SlashCommandAutoCompleteOption} b
     */
    fuzzyScoreCompare(a, b) {
        if (a.score.start < b.score.start) return -1;
        if (a.score.start > b.score.start) return 1;
        if (a.score.longestConsecutive > b.score.longestConsecutive) return -1;
        if (a.score.longestConsecutive < b.score.longestConsecutive) return 1;
        return a.name.localeCompare(b.name);
    }

    /**
     * Show the autocomplete.
     * @param {boolean} isInput Whether triggered by input.
     * @param {boolean} isForced Whether force-showing (ctrl+space).
     */
    async show(isInput = false, isForced = false) {
        //TODO check if isInput and isForced are both required
        this.text = this.textarea.value;
        // only show with textarea in focus
        if (document.activeElement != this.textarea) return this.hide();
        // only show for slash commands
        if (this.text[0] != '/') return this.hide();

        this.buildCache();

        // request parser to get command executor (potentially "incomplete", i.e. not an actual existing command) for
        // cursor position
        this.parserResult = this.parser.getNameAt(this.text, this.textarea.selectionStart);
        switch (this.parserResult?.type) {
            case NAME_RESULT_TYPE.CLOSURE: {
                this.startQuote = this.text[this.parserResult.start - 2] == '"';
                this.endQuote = this.startQuote && this.text[this.parserResult.start - 2 + this.parserResult.name.length + 1] == '"';
                try {
                    const qrApi = (await import('../extensions/quick-reply/index.js')).quickReplyApi;
                    this.parserResult.optionList.push(...qrApi.listSets()
                        .map(set=>qrApi.listQuickReplies(set).map(qr=>`${set}.${qr}`))
                        .flat()
                        .map(qr=>new SlashCommandAutoCompleteOption(OPTION_TYPE.QUICK_REPLY, qr, qr)),
                    );
                } catch { /* empty */ }
                break;
            }
            case NAME_RESULT_TYPE.COMMAND: {
                this.parserResult.optionList.push(...Object.keys(this.parser.commands)
                    .map(key=>new SlashCommandAutoCompleteOption(OPTION_TYPE.COMMAND, this.parser.commands[key], key)),
                );
                break;
            }
            default: {
                // no result
                break;
            }
        }
        this.slashCommand = this.parserResult?.name?.toLowerCase() ?? '';
        // do autocomplete if triggered by a user input and we either don't have an executor or the cursor is at the end
        // of the name part of the command
        switch (this.parserResult?.type) {
            case NAME_RESULT_TYPE.CLOSURE: {
                this.isReplaceable = isInput && (!this.parserResult ? true : this.textarea.selectionStart == this.parserResult.start - 2 + this.parserResult.name.length + (this.startQuote ? 1 : 0));
                break;
            }
            default: // no result
            case NAME_RESULT_TYPE.COMMAND: {
                this.isReplaceable = isInput && (!this.parserResult ? true : this.textarea.selectionStart == this.parserResult.start - 2 + this.parserResult.name.length);
                break;
            }
        }

        // if [forced (ctrl+space) or user input] and cursor is in the middle of the name part (not at the end)
        if (isForced || isInput) {
            switch (this.parserResult?.type) {
                case NAME_RESULT_TYPE.CLOSURE: {
                    if (this.textarea.selectionStart >= this.parserResult.start - 2 && this.textarea.selectionStart <= this.parserResult.start - 2 + this.parserResult.name.length + (this.startQuote ? 1 : 0)) {
                        this.slashCommand = this.slashCommand.slice(0, this.textarea.selectionStart - (this.parserResult.start - 2) - (this.startQuote ? 1 : 0));
                        this.parserResult.name = this.slashCommand;
                        this.isReplaceable = true;
                    }
                    break;
                }
                case NAME_RESULT_TYPE.COMMAND: {
                    if (this.textarea.selectionStart >= this.parserResult.start - 2 && this.textarea.selectionStart <= this.parserResult.start - 2 + this.parserResult.name.length) {
                        this.slashCommand = this.slashCommand.slice(0, this.textarea.selectionStart - (this.parserResult.start - 2));
                        this.parserResult.name = this.slashCommand;
                        this.isReplaceable = true;
                    }
                    break;
                }
                default: {
                    // no result
                    break;
                }
            }
        }

        this.fuzzyRegex = new RegExp(`^(.*?)${this.slashCommand.split('').map(char=>`(${escapeRegex(char)})`).join('(.*?)')}(.*?)$`, 'i');
        const matchers = {
            'strict': (name) => name.toLowerCase().startsWith(this.slashCommand),
            'includes': (name) => name.toLowerCase().includes(this.slashCommand),
            'fuzzy': (name) => this.fuzzyRegex.test(name),
        };

        // don't show if no executor found, i.e. cursor's area is not a command
        if (!this.parserResult) return this.hide();
        else {
            let matchingOptions = this.parserResult.optionList
                .filter(it => this.isReplaceable || it.name == '' ? matchers[this.matchType](it.name) : it.name.toLowerCase() == this.slashCommand) // Filter by the input
                .filter((it,idx,list) => list.findIndex(opt=>opt.value == it.value) == idx)
            ;
            this.result = matchingOptions
                .filter((it,idx) => matchingOptions.indexOf(it) == idx)
                .map(option => {
                    let li;
                    switch (option.type) {
                        case OPTION_TYPE.QUICK_REPLY: {
                            li = this.makeItem(option.name, 'QR', true);
                            break;
                        }
                        case OPTION_TYPE.VARIABLE_NAME: {
                            li = this.makeItem(option.name, '𝑥', true);
                            break;
                        }
                        case OPTION_TYPE.COMMAND: {
                            li = this.items[option.name];
                            break;
                        }
                    }
                    option.replacer = option.name.includes(' ') || this.startQuote || this.endQuote ? `"${option.name}"` : `${option.name}`;
                    option.dom = li;
                    if (this.matchType == 'fuzzy') this.fuzzyScore(option);
                    this.updateName(option);
                    return option;
                }) // Map to the help string and score
                .toSorted(this.matchType == 'fuzzy' ? this.fuzzyScoreCompare : (a, b) => a.name.localeCompare(b.name)) // sort by score (if fuzzy) or name
            ;
        }

        if (this.result.length == 0) {
            // no result and no input? hide autocomplete
            if (!isInput) {
                return this.hide();
            }
            // otherwise add "no match" notice
            const option = new SlashCommandAutoCompleteOption(
                OPTION_TYPE.BLANK,
                null,
                '',
            );
            switch (this.parserResult?.type) {
                case NAME_RESULT_TYPE.CLOSURE: {
                    const li = document.createElement('li'); {
                        li.textContent = this.slashCommand.length ?
                            `No matching variables in scope and no matching Quick Replies for "${this.slashCommand}"`
                            : 'No variables in scope and no Quick Replies found.';
                    }
                    option.dom = li;
                    this.result.push(option);
                    break;
                }
                case NAME_RESULT_TYPE.COMMAND: {
                    const li = document.createElement('li'); {
                        li.textContent = `No matching commands for "/${this.slashCommand}"`;
                    }
                    option.dom = li;
                    this.result.push(option);
                    break;
                }
            }
        } else if (this.result.length == 1 && this.parserResult && this.result[0].name == this.parserResult.name) {
            // only one result that is exactly the current value? just show hint, no autocomplete
            this.isReplaceable = false;
            this.isShowingDetails = false;
        } else if (!this.isReplaceable && this.result.length > 1) {
            return this.hide();
        }
        this.selectedItem = this.result[0];
        this.isActive = true;
        this.renderDebounced();
    }

    /**
     * Hide autocomplete.
     */
    hide() {
        this.domWrap?.remove();
        this.detailsWrap?.remove();
        this.isActive = false;
        this.isShowingDetails = false;
    }



    /**
     * Create updated DOM.
     */
    render() {
        // render autocomplete list
        if (this.isReplaceable) {
            this.dom.innerHTML = '';
            this.dom.classList.remove('defaultDark');
            this.dom.classList.remove('defaultLight');
            this.dom.classList.remove('defaultThemed');
            this.detailsDom.classList.remove('defaultDark');
            this.detailsDom.classList.remove('defaultLight');
            this.detailsDom.classList.remove('defaultThemed');
            switch (power_user.stscript.autocomplete_style ?? 'theme') {
                case 'dark': {
                    this.dom.classList.add('defaultDark');
                    this.detailsDom.classList.add('defaultDark');
                    break;
                }
                case 'light': {
                    this.dom.classList.add('defaultLight');
                    this.detailsDom.classList.add('defaultLight');
                    break;
                }
                case 'theme':
                default: {
                    this.dom.classList.add('defaultThemed');
                    this.detailsDom.classList.add('defaultThemed');
                    break;
                }
            }
            const frag = document.createDocumentFragment();
            for (const item of this.result) {
                if (item == this.selectedItem) {
                    item.dom.classList.add('selected');
                } else {
                    item.dom.classList.remove('selected');
                }
                frag.append(item.dom);
            }
            this.dom.append(frag);
            this.updatePosition();
            document.body.append(this.domWrap);
        } else {
            this.domWrap.remove();
        }
        this.renderDetailsDebounced();
    }

    /**
     * Create updated DOM for details.
     */
    renderDetails() {
        if (!this.isShowingDetails && this.isReplaceable) return this.detailsWrap.remove();
        this.detailsDom.innerHTML = '';
        this.detailsDom.append(this.selectedItem?.renderDetails() ?? 'NO ITEM');
        document.body.append(this.detailsWrap);
        this.updateDetailsPositionDebounced();
    }



    /**
     * Update position of DOM.
     */
    updatePosition() {
        if (this.isFloating) {
            this.updateFloatingPosition();
        } else {
            const rect = this.textarea.getBoundingClientRect();
            this.domWrap.style.setProperty('--bottom', `${window.innerHeight - rect.top}px`);
            this.domWrap.style.bottom = `${window.innerHeight - rect.top}px`;
            if (this.isShowingDetails) {
                this.domWrap.style.left = '1vw';
            } else {
                this.domWrap.style.left = `${rect.left}px`;
            }
            this.domWrap.style.right = `calc(1vw + ${this.isShowingDetails ? 25 : 0}vw)`;
            this.updateDetailsPosition();
        }
    }

    /**
     * Update position of details DOM.
     */
    updateDetailsPosition() {
        if (this.isShowingDetails || !this.isReplaceable) {
            if (this.isFloating) {
                this.updateFloatingDetailsPosition();
            } else {
                const rect = this.textarea.getBoundingClientRect();
                if (this.isReplaceable) {
                    const selRect = this.selectedItem.dom.children[0].getBoundingClientRect();
                    this.detailsWrap.style.setProperty('--targetOffset', `${selRect.top}`);
                    this.detailsWrap.style.bottom = this.domWrap.style.bottom;
                    this.detailsWrap.style.left = `calc(100vw - ${this.domWrap.style.right})`;
                    this.detailsWrap.style.right = '1vw';
                    this.detailsWrap.style.top = '5vh';
                } else {
                    this.detailsWrap.style.setProperty('--targetOffset', `${rect.top}`);
                    this.detailsWrap.style.bottom = this.domWrap.style.bottom;
                    this.detailsWrap.style.left = `${rect.left}px`;
                    this.detailsWrap.style.right = `calc(100vw - ${rect.right}px)`;
                    this.detailsWrap.style.top = '5vh';
                }
            }
        }
    }


    /**
     * Update position of floating autocomplete.
     */
    updateFloatingPosition() {
        const location = this.getCursorPosition();
        const rect = this.textarea.getBoundingClientRect();
        // cursor is out of view -> hide
        if (location.bottom < rect.top || location.top > rect.bottom || location.left < rect.left || location.left > rect.right) {
            return this.hide();
        }
        const left = Math.max(rect.left, location.left);
        this.domWrap.style.setProperty('--targetOffset', `${left}`);
        if (location.top <= window.innerHeight / 2) {
            // if cursor is in lower half of window, show list above line
            this.domWrap.style.top = `${location.bottom}px`;
            this.domWrap.style.bottom = 'auto';
            this.domWrap.style.maxHeight = `calc(${location.bottom}px - 1vh)`;
        } else {
            // if cursor is in upper half of window, show list below line
            this.domWrap.style.top = 'auto';
            this.domWrap.style.bottom = `calc(100vh - ${location.top}px)`;
            this.domWrap.style.maxHeight = `calc(${location.top}px - 1vh)`;
        }
    }

    updateFloatingDetailsPosition(location = null) {
        if (!location) location = this.getCursorPosition();
        const rect = this.textarea.getBoundingClientRect();
        if (location.bottom < rect.top || location.top > rect.bottom || location.left < rect.left || location.left > rect.right) {
            return this.hide();
        }
        const left = Math.max(rect.left, location.left);
        this.detailsWrap.style.setProperty('--targetOffset', `${left}`);
        if (this.isReplaceable) {
            this.detailsWrap.classList.remove('full');
            if (left < window.innerWidth / 4) {
                // if cursor is in left part of screen, show details on right of list
                this.detailsWrap.classList.add('right');
            } else {
                // if cursor is in right part of screen, show details on left of list
                this.detailsWrap.classList.remove('right');
            }
        } else {
            this.detailsWrap.classList.remove('right');
            this.detailsWrap.classList.add('full');
        }
        if (location.top <= window.innerHeight / 2) {
            // if cursor is in lower half of window, show list above line
            this.detailsWrap.style.top = `${location.bottom}px`;
            this.detailsWrap.style.bottom = 'auto';
            this.detailsWrap.style.maxHeight = `calc(${location.bottom}px - 1vh)`;
        } else {
            // if cursor is in upper half of window, show list below line
            this.detailsWrap.style.top = 'auto';
            this.detailsWrap.style.bottom = `calc(100vh - ${location.top}px)`;
            this.detailsWrap.style.maxHeight = `calc(${location.top}px - 1vh)`;
        }
    }

    /**
     * Calculate (keyboard) cursor coordinates within textarea.
     * @returns {{left:number, top:number, bottom:number}}
     */
    getCursorPosition() {
        const inputRect = this.textarea.getBoundingClientRect();
        const style = window.getComputedStyle(this.textarea);
        if (!this.clone) {
            this.clone = document.createElement('div');
            for (const key of style) {
                this.clone.style[key] = style[key];
            }
            this.clone.style.position = 'fixed';
            this.clone.style.visibility = 'hidden';
            document.body.append(this.clone);
            const mo = new MutationObserver(muts=>{
                if (muts.find(it=>Array.from(it.removedNodes).includes(this.textarea))) {
                    this.clone.remove();
                }
            });
            mo.observe(this.textarea.parentElement, { childList:true });
        }
        this.clone.style.height = `${inputRect.height}px`;
        this.clone.style.left = `${inputRect.left}px`;
        this.clone.style.top = `${inputRect.top}px`;
        this.clone.style.whiteSpace = style.whiteSpace;
        this.clone.style.tabSize = style.tabSize;
        const text = this.textarea.value;
        const before = text.slice(0, this.textarea.selectionStart);
        this.clone.textContent = before;
        const locator = document.createElement('span');
        locator.textContent = text[this.textarea.selectionStart];
        this.clone.append(locator);
        this.clone.append(text.slice(this.textarea.selectionStart + 1));
        this.clone.scrollTop = this.textarea.scrollTop;
        this.clone.scrollLeft = this.textarea.scrollLeft;
        const locatorRect = locator.getBoundingClientRect();
        const location = {
            left: locatorRect.left,
            top: locatorRect.top,
            bottom: locatorRect.bottom,
        };
        return location;
    }


    /**
     * Toggle details view alongside autocomplete list.
     */
    toggleDetails() {
        this.isShowingDetails = !this.isShowingDetails;
        this.renderDetailsDebounced();
        this.updatePosition();
    }


    /**
     * Select an item for autocomplete and put text into textarea.
     */
    async select() {
        if (this.isReplaceable && this.selectedItem.value !== null) {
            this.textarea.value = `${this.text.slice(0, this.parserResult.start - 2)}${this.selectedItem.replacer}${this.text.slice(this.parserResult.start - 2 + this.parserResult.name.length + (this.startQuote ? 1 : 0) + (this.endQuote ? 1 : 0))}`;
            await this.pointerup;
            this.textarea.focus();
            this.textarea.selectionStart = this.parserResult.start - 2 + this.selectedItem.replacer.length;
            this.textarea.selectionEnd = this.textarea.selectionStart;
            this.show();
        } else {
            const selectionStart = this.textarea.selectionStart;
            const selectionEnd = this.textarea.selectionDirection;
            await this.pointerup;
            this.textarea.focus();
            this.textarea.selectionStart = selectionStart;
            this.textarea.selectionDirection = selectionEnd;
        }
    }


    /**
     * Mark the item at newIdx in the autocomplete list as selected.
     * @param {number} newIdx
     */
    selectItemAtIndex(newIdx) {
        this.selectedItem.dom.classList.remove('selected');
        this.selectedItem = this.result[newIdx];
        this.selectedItem.dom.classList.add('selected');
        const rect = this.selectedItem.dom.children[0].getBoundingClientRect();
        const rectParent = this.dom.getBoundingClientRect();
        if (rect.top < rectParent.top || rect.bottom > rectParent.bottom ) {
            this.dom.scrollTop += rect.top < rectParent.top ? rect.top - rectParent.top : rect.bottom - rectParent.bottom;
        }
        this.renderDetailsDebounced();
    }

    /**
     * Handle keyboard events.
     * @param {KeyboardEvent} evt The event.
     */
    async handleKeyDown(evt) {
        // autocomplete is shown and cursor at end of current command name (or inside name and typed or forced)
        if (this.isActive && this.isReplaceable) {
            switch (evt.key) {
                case 'ArrowUp': {
                    // select previous item
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey) return;
                    evt.preventDefault();
                    evt.stopPropagation();
                    const idx = this.result.indexOf(this.selectedItem);
                    let newIdx;
                    if (idx == 0) newIdx = this.result.length - 1;
                    else newIdx = idx - 1;
                    this.selectItemAtIndex(newIdx);
                    return;
                }
                case 'ArrowDown': {
                    // select next item
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey) return;
                    evt.preventDefault();
                    evt.stopPropagation();
                    const idx = this.result.indexOf(this.selectedItem);
                    const newIdx = (idx + 1) % this.result.length;
                    this.selectItemAtIndex(newIdx);
                    return;
                }
                case 'Enter':
                case 'Tab': {
                    // pick the selected item to autocomplete
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey || this.selectedItem.type == OPTION_TYPE.BLANK) break;
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                    this.select();
                    return;
                }
            }
        }
        // autocomplete is shown, cursor can be anywhere
        if (this.isActive) {
            switch (evt.key) {
                case 'Escape': {
                    // close autocomplete
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey) return;
                    evt.preventDefault();
                    evt.stopPropagation();
                    this.hide();
                    return;
                }
                case 'Enter': {
                    // hide autocomplete on enter (send, execute, ...)
                    if (!evt.shiftKey) {
                        this.hide();
                        return;
                    }
                    break;
                }
            }
        }
        // autocomplete shown or not, cursor anywhere
        switch (evt.key) {
            case ' ': {
                if (evt.ctrlKey) {
                    if (this.isActive && this.isReplaceable) {
                        // ctrl-space to toggle details for selected item
                        this.toggleDetails();
                    } else {
                        // ctrl-space to force show autocomplete
                        this.show(true, true);
                    }
                    return;
                }
                break;
            }
        }
        if (['Control', 'Shift', 'Alt'].includes(evt.key)) {
            // ignore keydown on modifier keys
            return;
        }
        switch (evt.key) {
            default:
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowRight':
            case 'ArrowLeft': {
                if (this.isActive) {
                    // keyboard navigation, wait for keyup to complete cursor move
                    const oldText = this.textarea.value;
                    await new Promise(resolve=>{
                        window.addEventListener('keyup', resolve, { once:true });
                    });
                    if (this.selectionStart != this.textarea.selectionStart) {
                        this.selectionStart = this.textarea.selectionStart;
                        this.show(oldText != this.textarea.value);
                    }
                }
            }
        }
    }
}
