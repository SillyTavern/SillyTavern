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
 * @property {boolean} isTypingSeparator - Whether cursor is on a partial separator (single ':').
 * @property {boolean} hasSpaceAfterIdentifier - Whether there's a space after the identifier (for space-separated args).
 * @property {boolean} hasSpaceArgContent - Whether there's actual content after the space (not just whitespace).
 * @property {number} separatorCount - Number of '::' separators found.
 * @property {boolean} [isInScopedContent] - Whether cursor is in scoped content (after }} but before closing tag).
 * @property {string} [scopedMacroName] - Name of the scoped macro if in scoped content.
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

        // Check for arity warnings
        const warning = this.#getArityWarning();
        if (warning) {
            const warningEl = this.#renderWarning(warning);
            frag.append(warningEl);
        }

        // Show scoped content info banner if we're in scoped content
        if (this.#context?.isInScopedContent) {
            const scopedInfo = this.#renderScopedContentInfo();
            if (scopedInfo) frag.append(scopedInfo);
        }

        // Determine current argument index for highlighting
        const currentArgIndex = this.#context?.currentArgIndex ?? -1;

        // Render argument hint banner if we're typing an argument (and no warning)
        if (!warning && currentArgIndex >= 0) {
            const hint = this.#renderArgumentHint();
            if (hint) frag.append(hint);
        }

        // Reuse MacroBrowser's renderMacroDetails with options
        // Don't highlight args if there's a warning
        const details = renderMacroDetails(this.#macro, { currentArgIndex: warning ? -1 : currentArgIndex });

        // Add class for autocomplete-specific styling overrides
        details.classList.add('macro-ac-details');
        frag.append(details);

        return frag;
    }

    /**
     * Checks for arity-related warnings based on the current context.
     * @returns {string|null} Warning message, or null if no warning.
     */
    #getArityWarning() {
        if (!this.#context) return null;

        const argCount = this.#context.args.length;
        const maxArgs = this.#macro.maxArgs;
        const minArgs = this.#macro.minArgs;
        const hasList = this.#macro.list !== null;

        // Check for too many arguments (only if no list args)
        if (!hasList && argCount > maxArgs) {
            return `Too many arguments: this macro accepts ${maxArgs === 0 ? 'no arguments' : `up to ${maxArgs} argument${maxArgs === 1 ? '' : 's'}`}, but ${argCount} provided.`;
        }

        // Check for space-separated arg on macro that doesn't accept single arg
        // Only warn if there's actual content after the space (not just whitespace)
        if (this.#context.hasSpaceArgContent) {
            if (maxArgs === 0) {
                return 'This macro does not accept any arguments. Remove the space or use a different macro.';
            }
            if (maxArgs > 1 || minArgs > 1) {
                return `Space-separated syntax only works for single-argument macros. Use :: separators instead: {{${this.#macro.name}::arg1::arg2}}`;
            }
        }

        // Check if trying to add args to a no-arg macro via ::
        if (this.#context.separatorCount > 0 && maxArgs === 0) {
            return 'This macro does not accept any arguments.';
        }

        return null;
    }

    /**
     * Renders a warning banner.
     * @param {string} message - The warning message.
     * @returns {HTMLElement}
     */
    #renderWarning(message) {
        const warning = document.createElement('div');
        warning.classList.add('macro-ac-warning');

        const icon = document.createElement('i');
        icon.classList.add('fa-solid', 'fa-triangle-exclamation');
        warning.append(icon);

        const text = document.createElement('span');
        text.textContent = message;
        warning.append(text);

        return warning;
    }

    /**
     * Renders the scoped content info banner.
     * Shows when cursor is inside scoped content of an unclosed macro.
     * @returns {HTMLElement|null}
     */
    #renderScopedContentInfo() {
        if (!this.#context?.isInScopedContent) return null;

        const info = document.createElement('div');
        info.classList.add('macro-ac-scoped-info');

        const icon = document.createElement('i');
        icon.classList.add('fa-solid', 'fa-layer-group');
        info.append(icon);

        const text = document.createElement('span');
        text.innerHTML = `Typing <strong>scoped content</strong> for <code>{{${this.#context.scopedMacroName}}}</code>. Close with <code>{{/${this.#context.scopedMacroName}}}</code>`;
        info.append(text);

        return info;
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
 * Autocomplete option for closing a scoped macro.
 * Suggests {{/macroName}} to close an unclosed scoped macro.
 */
export class MacroClosingTagAutoCompleteOption extends AutoCompleteOption {
    /** @type {string} */
    #macroName;

    /**
     * @param {string} macroName - The name of the macro to close.
     */
    constructor(macroName) {
        // The closing tag is what we're suggesting - use /macroName as the name for matching
        const closingTag = `/${macroName}`;
        super(closingTag, '{/}');
        this.#macroName = macroName;

        // Custom valueProvider to return the correct replacement text
        // The input is what the user typed (e.g., "/" or "/set" or "/setvar")
        // We need to return just the part to insert (completing the closing tag)
        this.valueProvider = (input) => {
            // Return the rest of the closing tag name + }}
            const fullClosing = `/${macroName}}}`;
            if (fullClosing.startsWith(input)) {
                return fullClosing.slice(input.length);
            }
            // Fallback: return full closing
            return fullClosing;
        };

        // Make selectable so TAB completion works (valueProvider alone makes it non-selectable)
        this.makeSelectable = true;

        // Highest priority - closing tags should always appear at the very top
        this.sortPriority = 1;
    }

    /** @returns {string} */
    get macroName() {
        return this.#macroName;
    }

    /**
     * Renders the autocomplete list item for this closing tag.
     * Uses the same structure as other macro options for consistent styling.
     * @returns {HTMLElement}
     */
    renderItem() {
        const li = document.createElement('li');
        li.classList.add('item', 'macro-ac-item');

        // Type icon (same column as other macros)
        const type = document.createElement('span');
        type.classList.add('type', 'monospace');
        type.textContent = '{/}';
        li.append(type);

        // Specs container (for fuzzy highlight compatibility)
        const specs = document.createElement('span');
        specs.classList.add('specs');

        // Name element with character spans
        const nameEl = document.createElement('span');
        nameEl.classList.add('name', 'monospace');
        // Display full closing tag like other macros show full syntax
        const displayName = `{{/${this.#macroName}}}`;
        for (const char of displayName) {
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
        content.textContent = `Close the {{${this.#macroName}}} scoped macro.`;
        help.append(content);
        li.append(help);

        return li;
    }

    /**
     * Renders the details panel for this closing tag.
     * @returns {DocumentFragment}
     */
    renderDetails() {
        const frag = document.createDocumentFragment();

        const details = document.createElement('div');
        details.classList.add('macro-closing-tag-details');

        // Header
        const header = document.createElement('h3');
        header.innerHTML = `Close <code>{{${this.#macroName}}}</code>`;
        details.append(header);

        // Description
        const desc = document.createElement('p');
        desc.textContent = `Inserts the closing tag {{/${this.#macroName}}} to complete the scoped macro. The content between the opening and closing tags will be passed as the last argument.`;
        details.append(desc);

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
    // The "current" flag is the last one typed when cursor is still in the flags area
    // This ensures the last typed flag shows at the top of the autocomplete list
    let currentFlag = null;
    if (flags.length > 0) {
        // If cursor is at or after the last flag position but before identifier starts,
        // the last flag is the "current" one (just typed)
        const lastFlagEnd = flagEndPositions[flagEndPositions.length - 1];
        if (cursorOffset >= lastFlagEnd - 1) {
            currentFlag = flags[flags.length - 1];
        }
    }

    // Now parse the identifier and arguments starting from position i
    const remainingText = macroText.slice(i);
    const parts = [];
    /** @type {{ start: number, end: number }[]} */
    const separatorPositions = []; // Track positions of :: separators
    let currentPart = '';
    let partStart = i;
    let j = 0;

    while (j < remainingText.length) {
        if (remainingText[j] === ':' && remainingText[j + 1] === ':') {
            parts.push({ text: currentPart, start: partStart, end: i + j });
            separatorPositions.push({ start: i + j, end: i + j + 2 });
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

    // Determine if cursor is in the flags area (at or before identifier starts)
    const identifierStartPos = parts[0]?.start ?? i;
    const isInFlagsArea = cursorOffset <= identifierStartPos;

    // Check if cursor is on a partial separator (single ':' that might become '::')
    const isTypingSeparator = remainingText.length > 0 &&
        cursorOffset > identifierStartPos &&
        macroText[cursorOffset - 1] === ':' &&
        macroText[cursorOffset] !== ':' &&
        (cursorOffset < 2 || macroText[cursorOffset - 2] !== ':');

    // Parse identifier and space-separated argument from the first part
    // "getvar myvar" -> identifier="getvar", spaceArg="myvar"
    // "setvar " -> identifier="setvar", spaceArg="" (just whitespace, no content yet)
    const firstPartText = parts[0]?.text || '';
    const trimmedFirstPart = firstPartText.trimStart();
    const firstSpaceInIdentifier = trimmedFirstPart.search(/\s/);

    let identifierOnly;
    let spaceArgText = '';
    //let spaceArgStart = -1;
    let hasSpaceAfterIdentifier = false;

    if (firstSpaceInIdentifier > 0 && separatorPositions.length === 0) {
        // There's whitespace inside the first part - split identifier from space-arg
        identifierOnly = trimmedFirstPart.slice(0, firstSpaceInIdentifier);
        const afterIdentifier = trimmedFirstPart.slice(firstSpaceInIdentifier);
        // Check if there's actual content after the whitespace (not just spaces or ::)
        const contentAfterSpace = afterIdentifier.trimStart();
        hasSpaceAfterIdentifier = afterIdentifier.length > 0; // Has at least a space

        if (contentAfterSpace.length > 0 && !contentAfterSpace.startsWith(':')) {
            // There's actual argument content after the space
            spaceArgText = contentAfterSpace;
            //spaceArgStart = identifierStartPos + firstSpaceInIdentifier + (afterIdentifier.length - contentAfterSpace.length);
        }
    } else {
        identifierOnly = trimmedFirstPart.trimEnd();
    }

    // Calculate identifier end position (for space-after-identifier detection)
    const identifierEndPos = identifierStartPos + (firstPartText.length - firstPartText.trimStart().length) + identifierOnly.length;

    // Determine which part the cursor is in
    let currentArgIndex = -1;

    // Only consider being in an argument if we've passed a separator
    if (separatorPositions.length > 0) {
        // Find which argument we're in based on separator positions
        for (let sepIdx = 0; sepIdx < separatorPositions.length; sepIdx++) {
            const sep = separatorPositions[sepIdx];
            if (cursorOffset >= sep.end) {
                // We're past this separator, so we're in at least this argument
                currentArgIndex = sepIdx;
            }
        }
    } else if (spaceArgText.length > 0 || (hasSpaceAfterIdentifier && cursorOffset > identifierEndPos)) {
        // Space-separated arg: either has content, or cursor is past identifier+space
        currentArgIndex = 0;
    }

    // If typing a separator, we're still on identifier/previous arg, not the next one
    if (isTypingSeparator) {
        currentArgIndex = -1;
    }

    // Clean identifier: strip trailing colons (for partial :: typing)
    let cleanIdentifier = identifierOnly.replace(/:+$/, '');

    // Build args array - include space-separated arg if present
    let args = parts.slice(1).map(p => p.text);
    if (spaceArgText.length > 0) {
        args = [spaceArgText, ...args];
    }

    return {
        fullText: macroText,
        cursorOffset,
        identifier: cleanIdentifier,
        identifierStart: identifierStartPos,
        isInFlagsArea,
        flags,
        currentFlag,
        args,
        currentArgIndex,
        isTypingSeparator,
        hasSpaceAfterIdentifier,
        hasSpaceArgContent: spaceArgText.length > 0,
        separatorCount: separatorPositions.length,
    };
}
