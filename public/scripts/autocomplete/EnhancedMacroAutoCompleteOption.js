/**
 * Enhanced macro autocomplete option for the new MacroRegistry-based system.
 * Reuses rendering logic from MacroBrowser for consistency and DRY.
 */

import { AutoCompleteOption } from './AutoCompleteOption.js';
import {
    formatMacroSignature,
    createSourceIndicator,
    createAliasIndicator,
    renderMacroDetails,
} from '../macros/MacroBrowser.js';
import { enumIcons } from '../slash-commands/SlashCommandCommonEnumsProvider.js';
import { ValidFlagSymbols } from '../macros/engine/MacroFlags.js';

/** @typedef {import('../macros/engine/MacroRegistry.js').MacroDefinition} MacroDefinition */

/**
 * Macro context passed from the parser to provide cursor position info.
 * @typedef {Object} MacroAutoCompleteContext
 * @property {string} fullText - The full macro text being typed (without {{ }}).
 * @property {number} cursorOffset - Cursor position within the macro text.
 * @property {string} identifier - The macro identifier (name).
 * @property {number} identifierStart - Start position of the identifier within the macro text.
 * @property {string[]} flags - Array of flag symbols typed (e.g., ['!', '?']).
 * @property {string|null} currentFlag - The flag symbol cursor is currently on (last typed flag), or null.
 * @property {boolean} isInFlagsArea - Whether cursor is in the flags area (before identifier starts).
 * @property {string[]} args - Array of arguments typed so far.
 * @property {number} currentArgIndex - Index of the argument being typed (-1 if on identifier).
 */

export class EnhancedMacroAutoCompleteOption extends AutoCompleteOption {
    /** @type {MacroDefinition} */
    #macro;

    /** @type {MacroAutoCompleteContext|null} */
    #context = null;

    /**
     * @param {MacroDefinition} macro - The macro definition from MacroRegistry.
     * @param {MacroAutoCompleteContext} [context] - Optional context for argument hints.
     */
    constructor(macro, context = null) {
        // Use the macro name as the autocomplete key
        super(macro.name, enumIcons.macro);
        this.#macro = macro;
        this.#context = context;
        // nameOffset = 2 to skip the {{ prefix in the display (formatMacroSignature includes braces)
        this.nameOffset = 2;
    }

    /** @returns {MacroDefinition} */
    get macro() {
        return this.#macro;
    }

    /**
     * Renders the list item for the autocomplete dropdown.
     * Tight display: [icon] [signature] [description] [alias icon?] [source icon]
     * @returns {HTMLElement}
     */
    renderItem() {
        const li = document.createElement('li');
        li.classList.add('item', 'macro-ac-item');
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'macro');

        // Type icon
        const type = document.createElement('span');
        type.classList.add('type', 'monospace');
        type.textContent = '{}';
        li.append(type);

        // Specs container (for fuzzy highlight compatibility)
        const specs = document.createElement('span');
        specs.classList.add('specs');

        // Name with character spans for fuzzy highlighting
        const nameEl = document.createElement('span');
        nameEl.classList.add('name', 'monospace');

        // Build signature with individual character spans (includes {{ }})
        const sigText = formatMacroSignature(this.#macro);
        for (const char of sigText) {
            const span = document.createElement('span');
            span.textContent = char;
            nameEl.append(span);
        }
        specs.append(nameEl);
        li.append(specs);

        // Stopgap (spacer for flex layout)
        const stopgap = document.createElement('span');
        stopgap.classList.add('stopgap');
        li.append(stopgap);

        // Help text (description)
        const help = document.createElement('span');
        help.classList.add('help');
        const content = document.createElement('span');
        content.classList.add('helpContent');
        content.textContent = this.#macro.description || '';
        help.append(content);
        li.append(help);

        // Alias indicator icon (if this is an alias)
        const aliasIcon = createAliasIndicator(this.#macro);
        if (aliasIcon) {
            aliasIcon.classList.add('macro-ac-indicator');
            li.append(aliasIcon);
        }

        // Source indicator icon
        const sourceIcon = createSourceIndicator(this.#macro);
        sourceIcon.classList.add('macro-ac-indicator');
        li.append(sourceIcon);

        return li;
    }

    /**
     * Renders the details panel content.
     * Reuses renderMacroDetails from MacroBrowser with autocomplete-specific options.
     * @returns {DocumentFragment}
     */
    renderDetails() {
        const frag = document.createDocumentFragment();

        // Determine current argument index for highlighting
        const currentArgIndex = this.#context?.currentArgIndex ?? -1;

        // Render argument hint banner if we're typing an argument
        if (currentArgIndex >= 0) {
            const hint = this.#renderArgumentHint();
            if (hint) frag.append(hint);
        }

        // Reuse MacroBrowser's renderMacroDetails with options
        const details = renderMacroDetails(this.#macro, { currentArgIndex });

        // Add class for autocomplete-specific styling overrides
        details.classList.add('macro-ac-details');
        frag.append(details);

        return frag;
    }

    /**
     * Renders the current argument hint banner.
     * @returns {HTMLElement|null}
     */
    #renderArgumentHint() {
        if (!this.#context || this.#context.currentArgIndex < 0) return null;

        const argIndex = this.#context.currentArgIndex;
        const isListArg = argIndex >= this.#macro.maxArgs;

        // If we're beyond unnamed args and there's no list, no hint
        if (isListArg && !this.#macro.list) return null;

        const hint = document.createElement('div');
        hint.classList.add('macro-ac-arg-hint');

        const icon = document.createElement('i');
        icon.classList.add('fa-solid', 'fa-arrow-right');
        hint.append(icon);

        if (isListArg) {
            // List argument hint
            const listIndex = argIndex - this.#macro.maxArgs + 1;
            const text = document.createElement('span');
            text.innerHTML = `<strong>List item ${listIndex}</strong>`;
            hint.append(text);
        } else {
            // Unnamed argument hint (required or optional)
            const argDef = this.#macro.unnamedArgDefs[argIndex];
            let optionalLabel = '';
            if (argDef?.optional) {
                optionalLabel = argDef.defaultValue !== undefined
                    ? ` <em>(optional, default: ${argDef.defaultValue === '' ? '<empty string>' : argDef.defaultValue})</em>`
                    : ' <em>(optional)</em>';
            }
            const text = document.createElement('span');
            text.innerHTML = `<strong>${argDef?.name || `Argument ${argIndex + 1}`}</strong>${optionalLabel}`;
            if (argDef?.type) {
                const typeSpan = document.createElement('code');
                typeSpan.classList.add('macro-ac-hint-type');
                if (Array.isArray(argDef.type)) {
                    typeSpan.textContent = argDef.type.join(' | ');
                    typeSpan.title = `Accepts: ${argDef.type.join(', ')}`;
                } else {
                    typeSpan.textContent = argDef.type;
                }
                text.append(' ', typeSpan);
            }
            hint.append(text);

            if (argDef?.description) {
                const descSpan = document.createElement('span');
                descSpan.classList.add('macro-ac-hint-desc');
                descSpan.textContent = ` — ${argDef.description}`;
                hint.append(descSpan);
            }

            if (argDef?.sampleValue) {
                const sampleSpan = document.createElement('span');
                sampleSpan.classList.add('macro-ac-hint-sample');
                sampleSpan.textContent = ` (e.g. ${argDef.sampleValue})`;
                hint.append(sampleSpan);
            }
        }

        return hint;
    }
}

/**
 * Autocomplete option for macro execution flags.
 * Shows flag symbol, name, and description.
 */
export class MacroFlagAutoCompleteOption extends AutoCompleteOption {
    /** @type {import('../macros/engine/MacroFlags.js').MacroFlagDefinition} */
    #flagDef;

    /**
     * @param {import('../macros/engine/MacroFlags.js').MacroFlagDefinition} flagDef - The flag definition.
     */
    constructor(flagDef) {
        // Use the flag symbol as the name, with a flag icon
        super(flagDef.type, '🚩');
        this.#flagDef = flagDef;
    }

    /** @returns {import('../macros/engine/MacroFlags.js').MacroFlagDefinition} */
    get flagDefinition() {
        return this.#flagDef;
    }

    /**
     * Renders the autocomplete list item for this flag.
     * Must include .name element with character spans for fuzzy highlighting compatibility.
     * @returns {HTMLElement}
     */
    renderItem() {
        const li = document.createElement('li');
        li.classList.add('item', 'macro-flag-item');

        // Type icon
        const type = document.createElement('span');
        type.classList.add('type', 'monospace');
        type.textContent = '🚩';
        li.append(type);

        // Specs container (required for autocomplete structure)
        const specs = document.createElement('span');
        specs.classList.add('specs');

        // Name element with character spans (required for fuzzy highlighting)
        const nameEl = document.createElement('span');
        nameEl.classList.add('name', 'monospace');
        // Build name with individual character spans: "! FlagName"
        const displayName = `${this.#flagDef.type} ${this.#flagDef.name}`;
        for (const char of displayName) {
            const span = document.createElement('span');
            span.textContent = char;
            nameEl.append(span);
        }
        specs.append(nameEl);
        li.append(specs);

        // Stopgap (spacer)
        const stopgap = document.createElement('span');
        stopgap.classList.add('stopgap');
        li.append(stopgap);

        // Help text (description)
        const help = document.createElement('span');
        help.classList.add('help');
        const content = document.createElement('span');
        content.classList.add('helpContent');
        content.textContent = this.#flagDef.description + (this.#flagDef.implemented ? '' : ' (planned)');
        help.append(content);
        li.append(help);

        return li;
    }

    /**
     * Renders the details panel for this flag.
     * @returns {DocumentFragment}
     */
    renderDetails() {
        const frag = document.createDocumentFragment();

        const details = document.createElement('div');
        details.classList.add('macro-flag-details');

        // Header with flag symbol and name
        const header = document.createElement('h3');
        header.classList.add('macro-flag-details-header');
        header.innerHTML = `<code>${this.#flagDef.type}</code> ${this.#flagDef.name} Flag`;
        details.append(header);

        // Description
        const desc = document.createElement('p');
        desc.classList.add('macro-flag-details-desc');
        desc.textContent = this.#flagDef.description;
        details.append(desc);

        // Status
        const status = document.createElement('p');
        status.classList.add('macro-flag-details-status');
        status.innerHTML = `<strong>Status:</strong> ${this.#flagDef.implemented ? 'Implemented' : 'Planned for future release'}`;
        details.append(status);

        // Parser effect note
        if (this.#flagDef.affectsParser) {
            const parserNote = document.createElement('p');
            parserNote.classList.add('macro-flag-details-note');
            parserNote.innerHTML = '<em>This flag affects how the macro is parsed.</em>';
            details.append(parserNote);
        }

        frag.append(details);
        return frag;
    }
}

/**
 * Parses the macro text to determine current argument context.
 * Handles leading whitespace and flags before the identifier.
 *
 * @param {string} macroText - The text inside {{ }}, e.g., "roll::1d20" or "!user" or "  description  ".
 * @param {number} cursorOffset - Cursor position within macroText.
 * @returns {MacroAutoCompleteContext}
 */
export function parseMacroContext(macroText, cursorOffset) {
    let i = 0;

    // Skip leading whitespace
    while (i < macroText.length && /\s/.test(macroText[i])) {
        i++;
    }

    // Extract flags (special symbols before the identifier)
    // Track position after each flag to determine which flag cursor is on
    const flags = [];
    const flagEndPositions = []; // Position right after each flag (before any whitespace)
    while (i < macroText.length) {
        const char = macroText[i];
        if (ValidFlagSymbols.has(char)) {
            flags.push(char);
            i++;
            flagEndPositions.push(i); // Position right after this flag
            // Skip whitespace between flags
            while (i < macroText.length && /\s/.test(macroText[i])) {
                i++;
            }
        } else {
            break;
        }
    }

    // Determine which flag cursor is currently on (if any)
    // Cursor is "on" a flag if it's at or right after that flag's position
    let currentFlag = null;
    for (let idx = flags.length - 1; idx >= 0; idx--) {
        if (cursorOffset >= flagEndPositions[idx] - 1 && cursorOffset <= flagEndPositions[idx]) {
            currentFlag = flags[idx];
            break;
        }
    }

    // Now parse the identifier and arguments starting from position i
    const remainingText = macroText.slice(i);
    const parts = [];
    let currentPart = '';
    let partStart = i;
    let j = 0;

    while (j < remainingText.length) {
        if (remainingText[j] === ':' && remainingText[j + 1] === ':') {
            parts.push({ text: currentPart, start: partStart, end: i + j });
            currentPart = '';
            j += 2;
            partStart = i + j;
        } else {
            currentPart += remainingText[j];
            j++;
        }
    }
    // Push the last part
    parts.push({ text: currentPart, start: partStart, end: macroText.length });

    // Determine which part the cursor is in
    let currentArgIndex = -1;
    for (let idx = 0; idx < parts.length; idx++) {
        const part = parts[idx];
        if (cursorOffset >= part.start && cursorOffset <= part.end) {
            currentArgIndex = idx - 1; // -1 because first part is identifier
            break;
        }
    }

    // Determine if cursor is in the flags area (at or before identifier starts)
    const identifierStartPos = parts[0]?.start ?? i;
    const isInFlagsArea = cursorOffset <= identifierStartPos;

    // If cursor is in the flags/whitespace area before identifier, we're on the identifier
    if (currentArgIndex === -1 && isInFlagsArea) {
        currentArgIndex = -1;
    }

    // If cursor is after all parts (at the end), we're in the last arg
    if (currentArgIndex === -1 && parts.length > 0 && cursorOffset >= parts[parts.length - 1].end) {
        currentArgIndex = parts.length - 1;
    }

    return {
        fullText: macroText,
        cursorOffset,
        identifier: parts[0]?.text.trim() || '',
        identifierStart: identifierStartPos,
        isInFlagsArea,
        flags,
        currentFlag,
        args: parts.slice(1).map(p => p.text),
        currentArgIndex,
    };
}
