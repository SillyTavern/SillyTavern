import { power_user } from '../power-user.js';
import { debounce, escapeRegex } from '../utils.js';
import { AutoCompleteOption } from './AutoCompleteOption.js';
import { AutoCompleteFuzzyScore } from './AutoCompleteFuzzyScore.js';
import { BlankAutoCompleteOption } from './BlankAutoCompleteOption.js';
// eslint-disable-next-line no-unused-vars
import { AutoCompleteNameResult } from './AutoCompleteNameResult.js';
import { AutoCompleteSecondaryNameResult } from './AutoCompleteSecondaryNameResult.js';
import { Popup, getTopmostModalLayer } from '../popup.js';

/**@readonly*/
/**@enum {Number}*/
export const AUTOCOMPLETE_WIDTH = {
    'INPUT': 0,
    'CHAT': 1,
    'FULL': 2,
};

export class AutoComplete {
    /**@type {HTMLTextAreaElement}*/ textarea;
    /**@type {boolean}*/ isFloating = false;
    /**@type {()=>boolean}*/ checkIfActivate;
    /**@type {(text:string, index:number) => Promise<AutoCompleteNameResult>}*/ getNameAt;

    /**@type {boolean}*/ isActive = false;
    /**@type {boolean}*/ isReplaceable = false;
    /**@type {boolean}*/ isShowingDetails = false;
    /**@type {boolean}*/ wasForced = false;
    /**@type {boolean}*/ isForceHidden = false;
    /**@type {boolean}*/ canBeAutoHidden = false;

    /**@type {string}*/ text;
    /**@type {AutoCompleteNameResult}*/ parserResult;
    /**@type {AutoCompleteSecondaryNameResult}*/ secondaryParserResult;
    get effectiveParserResult() { return this.secondaryParserResult ?? this.parserResult; }
    /**@type {string}*/ name;

    /**@type {boolean}*/ startQuote;
    /**@type {boolean}*/ endQuote;
    /**@type {number}*/ selectionStart;

    /**@type {RegExp}*/ fuzzyRegex;

    /**@type {AutoCompleteOption[]}*/ result = [];
    /**@type {AutoCompleteOption}*/ selectedItem = null;

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

    get autoHide() {
        return power_user.stscript.autocomplete.autoHide ?? false;
    }




    /**
     * @param {HTMLTextAreaElement} textarea The textarea to receive autocomplete.
     * @param {() => boolean} checkIfActivate Function should return true only if under the current conditions, autocomplete should display (e.g., for slash commands: autoComplete.text[0] == '/')
     * @param {(text: string, index: number) => Promise<AutoCompleteNameResult>} getNameAt Function should return (unfiltered, matching against input is done in AutoComplete) information about name options at index in text.
     * @param {boolean} isFloating Whether autocomplete should float at the keyboard cursor.
     */
    constructor(textarea, checkIfActivate, getNameAt, isFloating = false) {
        this.textarea = textarea;
        this.checkIfActivate = checkIfActivate;
        this.getNameAt = getNameAt;
        this.isFloating = isFloating;

        this.domWrap = document.createElement('div'); {
            this.domWrap.classList.add('autoComplete-wrap');
            if (isFloating) this.domWrap.classList.add('isFloating');
        }
        this.dom = document.createElement('ul'); {
            this.dom.classList.add('autoComplete');
            this.domWrap.append(this.dom);
        }
        this.detailsWrap = document.createElement('div'); {
            this.detailsWrap.classList.add('autoComplete-detailsWrap');
            if (isFloating) this.detailsWrap.classList.add('isFloating');
        }
        this.detailsDom = document.createElement('div'); {
            this.detailsDom.classList.add('autoComplete-details');
            this.detailsWrap.append(this.detailsDom);
        }

        this.renderDebounced = debounce(this.render.bind(this), 10);
        this.renderDetailsDebounced = debounce(this.renderDetails.bind(this), 10);
        this.updatePositionDebounced = debounce(this.updatePosition.bind(this), 10);
        this.updateDetailsPositionDebounced = debounce(this.updateDetailsPosition.bind(this), 10);
        this.updateFloatingPositionDebounced = debounce(this.updateFloatingPosition.bind(this), 10);

        textarea.addEventListener('input', ()=>this.text != this.textarea.value && this.show(true, this.wasForced));
        textarea.addEventListener('keydown', (evt)=>this.handleKeyDown(evt));
        textarea.addEventListener('click', ()=>this.isActive ? this.show() : null);
        textarea.addEventListener('selectionchange', ()=>this.show());
        textarea.addEventListener('blur', ()=>this.hide());
        if (isFloating) {
            textarea.addEventListener('scroll', ()=>this.updateFloatingPositionDebounced());
        }
        window.addEventListener('resize', ()=>this.updatePositionDebounced());
    }

    /**
     *
     * @param {AutoCompleteOption} option
     */
    makeItem(option) {
        const li = option.renderItem();
        // gotta listen to pointerdown (happens before textarea-blur)
        li.addEventListener('pointerdown', (evt)=>{
            evt.preventDefault();
            this.selectedItem = this.result.find(it=>it.name == li.getAttribute('data-name'));
            this.select();
        });
        return li;
    }


    /**
     *
     * @param {AutoCompleteOption} item
     */
    updateName(item) {
        const chars = Array.from(item.dom.querySelector('.name').children);
        switch (this.matchType) {
            case 'strict': {
                chars.forEach((it, idx)=>{
                    if (idx + item.nameOffset < item.name.length) {
                        it.classList.add('matched');
                    } else {
                        it.classList.remove('matched');
                    }
                });
                break;
            }
            case 'includes': {
                const start = item.name.toLowerCase().search(this.name);
                chars.forEach((it, idx)=>{
                    if (idx + item.nameOffset < start) {
                        it.classList.remove('matched');
                    } else if (idx + item.nameOffset < start + item.name.length) {
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
                        let cIdx = item.nameOffset;
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
     * @param {AutoCompleteOption} option
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
        option.score = new AutoCompleteFuzzyScore(start, consecutive[0]?.length ?? 0);
        return option;
    }

    /**
     * Compare two auto complete options by their fuzzy score.
     * @param {AutoCompleteOption} a
     * @param {AutoCompleteOption} b
     */
    fuzzyScoreCompare(a, b) {
        if (a.score.start < b.score.start) return -1;
        if (a.score.start > b.score.start) return 1;
        if (a.score.longestConsecutive > b.score.longestConsecutive) return -1;
        if (a.score.longestConsecutive < b.score.longestConsecutive) return 1;
        return a.name.localeCompare(b.name);
    }

    basicAutoHideCheck() {
        // auto hide only if at least one char has been typed after the name + space
        return this.textarea.selectionStart > this.parserResult.start
            + this.parserResult.name.length
            + (this.startQuote ? 1 : 0)
            + (this.endQuote ? 1 : 0)
            + 1
        ;
    }

    /**
     * Show the autocomplete.
     * @param {boolean} isInput Whether triggered by input.
     * @param {boolean} isForced Whether force-showing (ctrl+space).
     * @param {boolean} isSelect Whether an autocomplete option was just selected.
     */
    async show(isInput = false, isForced = false, isSelect = false) {
        //TODO check if isInput and isForced are both required
        this.text = this.textarea.value;
        this.isReplaceable = false;

        if (document.activeElement != this.textarea) {
            // only show with textarea in focus
            return this.hide();
        }
        if (!this.checkIfActivate()) {
            // only show if provider wants to
            return this.hide();
        }

        // disable force-hide if trigger was forced
        if (isForced) this.isForceHidden = false;

        // request provider to get name result (potentially "incomplete", i.e. not an actual existing name) for
        // cursor position
        this.parserResult = await this.getNameAt(this.text, this.textarea.selectionStart);
        this.secondaryParserResult = null;

        if (!this.parserResult) {
            // don't show if no name result found, e.g., cursor's area is not a command
            return this.hide();
        }

        // need to know if name can be inside quotes, and then check if quotes are already there
        if (this.parserResult.canBeQuoted) {
            this.startQuote = this.text[this.parserResult.start] == '"';
            this.endQuote = this.startQuote && this.text[this.parserResult.start + this.parserResult.name.length + 1] == '"';
        } else {
            this.startQuote = false;
            this.endQuote = false;
        }

        // use lowercase name for matching
        this.name = this.parserResult.name.toLowerCase() ?? '';

        const isCursorInNamePart = this.textarea.selectionStart >= this.parserResult.start && this.textarea.selectionStart <= this.parserResult.start + this.parserResult.name.length + (this.startQuote ? 1 : 0);
        if (isForced || isInput) {
            // if forced (ctrl+space) or user input...
            if (isCursorInNamePart) {
                // ...and cursor is somewhere in the name part (including right behind the final char)
                // -> show autocomplete for the (partial if cursor in the middle) name
                this.name = this.name.slice(0, this.textarea.selectionStart - (this.parserResult.start) - (this.startQuote ? 1 : 0));
                this.parserResult.name = this.name;
                this.isReplaceable = true;
                this.isForceHidden = false;
                this.canBeAutoHidden = false;
            } else {
                this.isReplaceable = false;
                this.canBeAutoHidden = this.basicAutoHideCheck();
            }
        } else {
            // if not forced and no user input -> just show details
            this.isReplaceable = false;
            this.canBeAutoHidden = this.basicAutoHideCheck();
        }

        if (isForced || isInput || isSelect) {
            // is forced or user input or just selected autocomplete option...
            if (!isCursorInNamePart) {
                // ...and cursor is not somwehere in the main name part -> check for secondary options (e.g., named arguments)
                const result = this.parserResult.getSecondaryNameAt(this.text, this.textarea.selectionStart, isSelect);
                if (result && (isForced || result.isRequired)) {
                    this.secondaryParserResult = result;
                    this.name = this.secondaryParserResult.name;
                    this.isReplaceable = isForced || this.secondaryParserResult.isRequired;
                    this.isForceHidden = false;
                    this.canBeAutoHidden = false;
                } else {
                    this.isReplaceable = false;
                    this.canBeAutoHidden = this.basicAutoHideCheck();
                }
            }
        }

        if (this.matchType == 'fuzzy') {
            // only build the fuzzy regex if match type is set to fuzzy
            this.fuzzyRegex = new RegExp(`^(.*?)${this.name.split('').map(char=>`(${escapeRegex(char)})`).join('(.*?)')}(.*?)$`, 'i');
        }

        //TODO maybe move the matchers somewhere else; a single match function? matchType is available as property
        const matchers = {
            'strict': (name) => name.toLowerCase().startsWith(this.name),
            'includes': (name) => name.toLowerCase().includes(this.name),
            'fuzzy': (name) => this.fuzzyRegex.test(name),
        };

        this.result = this.effectiveParserResult.optionList
            // filter the list of options by the partial name according to the matching type
            .filter(it => this.isReplaceable || it.name == '' ? matchers[this.matchType](it.name) : it.name.toLowerCase() == this.name)
            // remove aliases
            .filter((it,idx,list) => list.findIndex(opt=>opt.value == it.value) == idx);

        if (this.result.length == 0 && this.effectiveParserResult != this.parserResult && isForced) {
            // no matching secondary results and forced trigger -> show current command details
            this.secondaryParserResult = null;
            this.result = [this.effectiveParserResult.optionList.find(it=>it.name == this.effectiveParserResult.name)];
            this.name = this.effectiveParserResult.name;
            this.fuzzyRegex = /(.*)(.*)(.*)/;
        }

        this.result = this.result
            // update remaining options
            .map(option => {
                // build element
                option.dom = this.makeItem(option);
                // update replacer and add quotes if necessary
                if (this.effectiveParserResult.canBeQuoted) {
                    option.replacer = option.name.includes(' ') || this.startQuote || this.endQuote ? `"${option.name}"` : `${option.name}`;
                } else {
                    option.replacer = option.name;
                }
                // calculate fuzzy score if matching is fuzzy
                if (this.matchType == 'fuzzy') this.fuzzyScore(option);
                // update the name to highlight the matched chars
                this.updateName(option);
                return option;
            })
            // sort by fuzzy score or alphabetical
            .toSorted(this.matchType == 'fuzzy' ? this.fuzzyScoreCompare : (a, b) => a.name.localeCompare(b.name))
        ;



        if (this.isForceHidden) {
            // hidden with escape
            return this.hide();
        }
        if (this.autoHide && this.canBeAutoHidden && !isForced && this.effectiveParserResult == this.parserResult && this.result.length == 1) {
            // auto hide user setting enabled and somewhere after name part and would usually show command details
            return this.hide();
        }
        if (this.result.length == 0) {
            if (!isInput) {
                // no result and no input? hide autocomplete
                return this.hide();
            }
            if (this.effectiveParserResult instanceof AutoCompleteSecondaryNameResult && !this.effectiveParserResult.forceMatch) {
                // no result and matching is no forced? hide autocomplete
                return this.hide();
            }
            // otherwise add "no match" notice
            const option = new BlankAutoCompleteOption(
                this.name.length ?
                    this.effectiveParserResult.makeNoMatchText()
                    : this.effectiveParserResult.makeNoOptionsText()
                ,
            );
            this.result.push(option);
        } else if (this.result.length == 1 && this.effectiveParserResult && this.result[0].name == this.effectiveParserResult.name) {
            // only one result that is exactly the current value? just show hint, no autocomplete
            this.isReplaceable = false;
            this.isShowingDetails = false;
        } else if (!this.isReplaceable && this.result.length > 1) {
            return this.hide();
        }
        this.selectedItem = this.result[0];
        this.isActive = true;
        this.wasForced = isForced;
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
        this.wasForced = false;
    }



    /**
     * Create updated DOM.
     */
    render() {
        if (!this.isActive) return this.domWrap.remove();
        if (this.isReplaceable) {
            this.dom.innerHTML = '';
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
            getTopmostModalLayer().append(this.domWrap);
        } else {
            this.domWrap.remove();
        }
        this.renderDetailsDebounced();
    }

    /**
     * Create updated DOM for details.
     */
    renderDetails() {
        if (!this.isActive) return this.detailsWrap.remove();
        if (!this.isShowingDetails && this.isReplaceable) return this.detailsWrap.remove();
        this.detailsDom.innerHTML = '';
        this.detailsDom.append(this.selectedItem?.renderDetails() ?? 'NO ITEM');
        getTopmostModalLayer().append(this.detailsWrap);
        this.updateDetailsPositionDebounced();
    }



    /**
     * Update position of DOM.
     */
    updatePosition() {
        if (this.isFloating) {
            this.updateFloatingPosition();
        } else {
            const rect = {};
            rect[AUTOCOMPLETE_WIDTH.INPUT] = this.textarea.getBoundingClientRect();
            rect[AUTOCOMPLETE_WIDTH.CHAT] = document.querySelector('#sheld').getBoundingClientRect();
            rect[AUTOCOMPLETE_WIDTH.FULL] = getTopmostModalLayer().getBoundingClientRect();
            this.domWrap.style.setProperty('--bottom', `${window.innerHeight - rect[AUTOCOMPLETE_WIDTH.INPUT].top}px`);
            this.dom.style.setProperty('--bottom', `${window.innerHeight - rect[AUTOCOMPLETE_WIDTH.INPUT].top}px`);
            this.domWrap.style.bottom = `${window.innerHeight - rect[AUTOCOMPLETE_WIDTH.INPUT].top}px`;
            if (this.isShowingDetails) {
                this.domWrap.style.setProperty('--leftOffset', '1vw');
                this.domWrap.style.setProperty('--leftOffset', `max(1vw, ${rect[power_user.stscript.autocomplete.width.left].left}px)`);
                this.domWrap.style.setProperty('--rightOffset', `calc(100vw - min(${rect[power_user.stscript.autocomplete.width.right].right}px, ${this.isShowingDetails ? 74 : 0}vw)`);
            } else {
                this.domWrap.style.setProperty('--leftOffset', `max(1vw, ${rect[power_user.stscript.autocomplete.width.left].left}px)`);
                this.domWrap.style.setProperty('--rightOffset', `calc(100vw - min(99vw, ${rect[power_user.stscript.autocomplete.width.right].right}px)`);
            }
        }
        this.updateDetailsPosition();
    }

    /**
     * Update position of details DOM.
     */
    updateDetailsPosition() {
        if (this.isShowingDetails || !this.isReplaceable) {
            if (this.isFloating) {
                this.updateFloatingDetailsPosition();
            } else {
                const rect = {};
                rect[AUTOCOMPLETE_WIDTH.INPUT] = this.textarea.getBoundingClientRect();
                rect[AUTOCOMPLETE_WIDTH.CHAT] = document.querySelector('#sheld').getBoundingClientRect();
                rect[AUTOCOMPLETE_WIDTH.FULL] = getTopmostModalLayer().getBoundingClientRect();
                if (this.isReplaceable) {
                    this.detailsWrap.classList.remove('full');
                    const selRect = this.selectedItem.dom.children[0].getBoundingClientRect();
                    this.detailsWrap.style.setProperty('--targetOffset', `${selRect.top}`);
                    this.detailsWrap.style.setProperty('--rightOffset', '1vw');
                    this.detailsWrap.style.setProperty('--bottomOffset', `calc(100vh - ${rect[AUTOCOMPLETE_WIDTH.INPUT].top}px)`);
                    this.detailsWrap.style.setProperty('--leftOffset', `calc(100vw - ${this.domWrap.style.getPropertyValue('--rightOffset')}`);
                } else {
                    this.detailsWrap.classList.add('full');
                    this.detailsWrap.style.setProperty('--targetOffset', `${rect[AUTOCOMPLETE_WIDTH.INPUT].top}`);
                    this.detailsWrap.style.setProperty('--bottomOffset', `calc(100vh - ${rect[AUTOCOMPLETE_WIDTH.INPUT].top}px)`);
                    this.detailsWrap.style.setProperty('--leftOffset', `${rect[power_user.stscript.autocomplete.width.left].left}px`);
                    this.detailsWrap.style.setProperty('--rightOffset', `calc(100vw - ${rect[power_user.stscript.autocomplete.width.right].right}px)`);
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
                this.detailsWrap.classList.remove('left');
            } else {
                // if cursor is in right part of screen, show details on left of list
                this.detailsWrap.classList.remove('right');
                this.detailsWrap.classList.add('left');
            }
        } else {
            this.detailsWrap.classList.remove('left');
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
            getTopmostModalLayer().append(this.clone);
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
            this.textarea.value = `${this.text.slice(0, this.effectiveParserResult.start)}${this.selectedItem.replacer}${this.text.slice(this.effectiveParserResult.start + this.effectiveParserResult.name.length + (this.startQuote ? 1 : 0) + (this.endQuote ? 1 : 0))}`;
            this.textarea.selectionStart = this.effectiveParserResult.start + this.selectedItem.replacer.length;
            this.textarea.selectionEnd = this.textarea.selectionStart;
            this.show(false, false, true);
        } else {
            const selectionStart = this.textarea.selectionStart;
            const selectionEnd = this.textarea.selectionDirection;
            this.textarea.selectionStart = selectionStart;
            this.textarea.selectionDirection = selectionEnd;
        }
        this.wasForced = false;
        this.textarea.dispatchEvent(new Event('input', { bubbles:true }));
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
            // actions in the list
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
                case 'Enter': {
                    // pick the selected item to autocomplete
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey || this.selectedItem.value == '') break;
                    if (this.selectedItem.name == this.name) break;
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                    this.select();
                    return;
                }
                case 'Tab': {
                    // pick the selected item to autocomplete
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey || this.selectedItem.value == '') break;
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                    this.select();
                    return;
                }
            }
        }
        // details are shown, cursor can be anywhere
        if (this.isActive) {
            switch (evt.key) {
                case 'Escape': {
                    // close autocomplete
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey) return;
                    evt.preventDefault();
                    evt.stopPropagation();
                    this.isForceHidden = true;
                    this.wasForced = false;
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
            // The first is a non-breaking space, the second is a regular space.
            case ' ':
            case ' ': {
                if (evt.ctrlKey || evt.altKey) {
                    if (this.isActive && this.isReplaceable) {
                        // ctrl-space to toggle details for selected item
                        this.toggleDetails();
                    } else {
                        // ctrl-space to force show autocomplete
                        this.show(false, true);
                    }
                    evt.preventDefault();
                    evt.stopPropagation();
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
                        this.show(this.isReplaceable || oldText != this.textarea.value);
                    }
                }
                break;
            }
            default: {
                if (this.isActive) {
                    this.text != this.textarea.value && this.show(this.isReplaceable);
                }
                break;
            }
        }
    }
}
