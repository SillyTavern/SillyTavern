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
} from '../macros/engine/MacroBrowser.js';
import { enumIcons } from '../slash-commands/SlashCommandCommonEnumsProvider.js';
import { ValidFlagSymbols } from '../macros/engine/MacroFlags.js';
import { MACRO_VARIABLE_SHORTHAND_PATTERN } from '../macros/engine/MacroLexer.js';
import { onboardingExperimentalMacroEngine } from '../macros/engine/MacroDiagnostics.js';

/** @typedef {import('../macros/engine/MacroRegistry.js').MacroDefinition} MacroDefinition */

/**
 * Macro context passed from the parser to provide cursor position info.
 * @typedef {Object} MacroAutoCompleteContext
 * @property {string} fullText - The full macro text being typed (without {{ }}).
 * @property {number} cursorOffset - Cursor position within the macro text.
 * @property {string} paddingBefore - Padding before the macro identifier/flags.
 * @property {string} identifier - The macro identifier (name).
 * @property {number} identifierStart - Start position of the identifier within the macro text.
 * @property {string[]} flags - Array of flag symbols typed (e.g., ['!', '?']).
 * @property {string|null} currentFlag - The flag symbol cursor is currently on (last typed flag), or null.
 * @property {boolean} isInFlagsArea - Whether cursor is in the flags area (before identifier starts).
 * @property {string[]} args - Array of arguments typed so far.
 * @property {number} currentArgIndex - Index of the argument being typed (-1 if on identifier).
 * @property {boolean} isTypingSeparator - Whether cursor is on a partial separator (single ':').
 * @property {boolean} isTypingClosingBrace - Whether cursor is typing the first closing brace on a standalone macro.
 * @property {boolean} hasSpaceAfterIdentifier - Whether there's a space after the identifier (for space-separated args).
 * @property {boolean} hasSpaceArgContent - Whether there's actual content after the space (not just whitespace).
 * @property {number} separatorCount - Number of '::' separators found.
 * @property {boolean} [isInScopedContent] - Whether cursor is in scoped content (after }} but before closing tag).
 * @property {boolean} [isScopedContentOptional] - Whether the scoped content is optional (for display purposes).
 * @property {string} [scopedMacroName] - Name of the scoped macro if in scoped content.
 * @property {boolean} isVariableShorthand - Whether this is a variable shorthand (starts with . or $).
 * @property {'.'|'$'|null} variablePrefix - The variable prefix (. for local, $ for global), or null.
 * @property {string} variableName - The variable name being typed (after the prefix).
 * @property {number} variableNameEnd - The end of the variable name (for partial matches).
 * @property {string|null} variableOperator - The operator typed (=, ++, --, +=), or null.
 * @property {number} variableOperatorEnd - The end of the variable operator (for partial matches).
 * @property {string} variableValue - The value after the operator (for = and +=).
 * @property {boolean} isTypingVariableName - Whether cursor is in the variable name area.
 * @property {boolean} isTypingOperator - Whether cursor is at/after variable name, ready for operator.
 * @property {boolean} isTypingValue - Whether cursor is after an operator that requires a value.
 * @property {boolean} [hasInvalidTrailingChars] - Whether there are invalid characters after the variable name.
 * @property {string} [invalidTrailingChars] - The invalid trailing characters (for error display).
 * @property {string} [partialOperator] - Partial operator prefix being typed ('+' or '-').
 * @property {boolean} [isOperatorComplete] - Whether a complete operator (++ or --) was typed that doesn't need a value.
 */

/**
 * @typedef {Object} EnhancedMacroAutoCompleteOptions
 * @property {boolean} [noBraces=false] - If true, display without {{ }} braces (for use as values, e.g., in {{if}} conditions).
 * @property {string} [paddingAfter=''] - Whitespace to add before closing }} (for matching opening whitespace style).
 * @property {boolean} [closeWithBraces=false] - If true, the completion will add }} to close the macro.
 * @property {string[]} [flags=[]] - The currently already written flags for this autocomplete.
 * @property {string} [currentFlag] - The current flag that is present, if any.
 * @property {string} [fullText] - The currently written full text.
 */

export class EnhancedMacroAutoCompleteOption extends AutoCompleteOption {
    /** @type {MacroDefinition} */
    #macro;

    /** @type {MacroAutoCompleteContext|null} */
    #context = null;

    /** @type {EnhancedMacroAutoCompleteOptions|null} */
    #options = null;

    /** @type {boolean} */
    #noBraces = false;

    /** @type {string} */
    #paddingAfter = '';

    /**
     * @param {MacroDefinition} macro - The macro definition from MacroRegistry.
     * @param {MacroAutoCompleteContext|EnhancedMacroAutoCompleteOptions|null} [contextOrOptions] - Context for argument hints, or options object.
     */
    constructor(macro, contextOrOptions = null) {
        // Use the macro name as the autocomplete key
        super(macro.name, enumIcons.macro);
        this.#macro = macro;

        // Detect if second argument is context or options
        // Context has 'identifier' property, options may have 'noBraces'
        if (contextOrOptions && typeof contextOrOptions === 'object') {
            if ('noBraces' in contextOrOptions || 'paddingAfter' in contextOrOptions || 'closeWithBraces' in contextOrOptions) {
                // It's an options object
                this.#options = /** @type {EnhancedMacroAutoCompleteOptions} */ (contextOrOptions);
                this.#noBraces = this.#options.noBraces ?? false;
                this.#paddingAfter = this.#options.paddingAfter ?? '';

                // If noBraces mode with closeWithBraces, complete with name + padding + }}
                if (this.#options.closeWithBraces) {
                    this.valueProvider = () => `${macro.name}${this.#paddingAfter}}}`;
                    this.makeSelectable = true;
                }
            } else {
                // It's a context object
                this.#context = /** @type {MacroAutoCompleteContext} */ (contextOrOptions);
            }
        }

        // nameOffset = 2 to skip the {{ prefix in the display (formatMacroSignature includes braces)
        // When noBraces is true, nameOffset = 0 since we don't show braces
        this.nameOffset = this.#noBraces ? 0 : 2;

        // For macros that take no arguments, auto-complete with closing }} (unless already set by options)
        if (!this.valueProvider) {
            const takesNoArgs = macro.minArgs === 0 && macro.maxArgs === 0 && macro.list === null;
            if (takesNoArgs) {
                this.valueProvider = () => `${macro.name}${this.#paddingAfter}}}`;
                this.makeSelectable = true; // Required when using valueProvider
            }
        }

        // {{//}} needs special handling. If we autocomplete right after **one** slash is already typed, we need to replace that, as it's treated as a flag otherwise.
        const fullText = this.#options?.fullText ?? this.#context?.fullText ?? '';
        if (macro.name === '//' && fullText.endsWith('/')) {
            this.replacementStartOffset = (this.replacementStartOffset ?? 0) - 1; // Cut the leading slash
        }
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

        // Build signature with individual character spans
        // When noBraces is true, show just the macro name without {{ }}
        const sigText = this.#noBraces ? this.#macro.name : formatMacroSignature(this.#macro);
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

        // For most warnings, we can still highlight which argument we are currently at.
        // This even goes for "too many arguments" when navigating the cursor back to
        // a valid argument.
        // Extend this in the future, if *some* warnings don't make sense to still highlight args.
        const hightlightArgsHint = currentArgIndex >= 0;

        // Render argument hint banner if we're typing an argument
        if (hightlightArgsHint && currentArgIndex >= 0) {
            const hint = this.#renderArgumentHint();
            if (hint) frag.append(hint);
        }

        // Reuse MacroBrowser's renderMacroDetails with options
        const details = renderMacroDetails(this.#macro, { currentArgIndex: hightlightArgsHint ? currentArgIndex : -1 });

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
        //const minArgs = this.#macro.minArgs;
        const hasList = this.#macro.list !== null;

        // Check for too many arguments (only if no list args)
        if (!hasList && argCount > maxArgs) {
            return `Too many arguments: this macro accepts ${maxArgs === 0 ? 'no arguments' : `up to ${maxArgs} argument${maxArgs === 1 ? '' : 's'}`}, but ${argCount} provided.`;
        }

        // Check for space-separated arg on macro that doesn't support it
        // Space-separated syntax provides 1 arg; with scoped content you can provide a 2nd arg
        // So it's valid for macros with maxArgs <= 2 (or with list args)
        if (this.#context.hasSpaceArgContent) {
            if (maxArgs === 0 && !hasList) {
                return 'This macro does not accept any arguments. Remove the space or use a different macro.';
            }
            if (!hasList && maxArgs > 2) {
                return `Space-separated syntax only works for macros with up to 2 arguments. Use :: separators instead: {{${this.#macro.name}::arg1::arg2}}`;
            }
        }

        // Check if trying to add args to a no-arg macro via ::
        // List-arg macros can accept args even if maxArgs === 0
        if (this.#context.separatorCount > 0 && maxArgs === 0 && !hasList) {
            return 'This macro does not accept any arguments.';
        }

        // Check list bounds (min/max) if the macro has a list with constraints
        if (hasList && typeof this.#macro.list === 'object') {
            const listItemCount = Math.max(0, argCount - maxArgs);
            const listMin = this.#macro.list.min ?? 0;
            const listMax = this.#macro.list.max ?? null;

            if (listItemCount < listMin) {
                const needed = listMin - listItemCount;
                return `Not enough list items yet: this macro requires at least ${listMin} item${listMin === 1 ? '' : 's'}, but only ${listItemCount} provided. Add ${needed} more.`;
            }

            if (listMax !== null && listItemCount > listMax) {
                return `Too many list items: this macro accepts at most ${listMax} item${listMax === 1 ? '' : 's'}, but ${listItemCount} provided.`;
            }
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

        // If the scoped content is optional, show a prominent OPTIONAL badge
        if (this.#context.isScopedContentOptional) {
            const optionalBadge = document.createElement('span');
            optionalBadge.classList.add('macro-ac-optional-badge');
            optionalBadge.textContent = 'OPTIONAL';
            info.append(optionalBadge);
        }

        const icon = document.createElement('i');
        icon.classList.add('fa-solid', 'fa-layer-group');
        info.append(icon);

        const text = document.createElement('span');
        const closingHint = this.#context.isScopedContentOptional
            ? `Can optionally close with <code>{{/${this.#context.scopedMacroName}}}</code>`
            : `Close with <code>{{/${this.#context.scopedMacroName}}}</code>`;
        text.innerHTML = `Typing <strong>scoped content</strong> for <code>{{${this.#context.scopedMacroName}}}</code>. ${closingHint}`;
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
            const totalListItems = this.#context.args.length - this.#macro.maxArgs;

            const text = document.createElement('span');
            text.innerHTML = `<strong>List item ${listIndex}</strong>${(listIndex < totalListItems ? ` (of ${totalListItems})` : '')}`;

            const listInfo = document.createElement('span');
            listInfo.classList.add('macro-ac-arg-hint-small');
            const minMax = [];
            if (this.#macro.list.min > 0) minMax.push(`min: ${this.#macro.list.min}`);
            if (this.#macro.list.max !== null) minMax.push(`max: ${this.#macro.list.max}`);
            if (minMax.length > 0) {
                listInfo.textContent = ` (list, ${minMax.join(', ')})`;
            } else {
                listInfo.textContent = ' (variable-length list)';
            }
            text.appendChild(listInfo);

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
 * Uses default AutoCompleteOption rendering for consistent styling.
 */
export class MacroFlagAutoCompleteOption extends AutoCompleteOption {
    /** @type {import('../macros/engine/MacroFlags.js').MacroFlagDefinition} */
    #flagDef;

    /**
     * @param {import('../macros/engine/MacroFlags.js').MacroFlagDefinition} flagDef - The flag definition.
     */
    constructor(flagDef) {
        // Use the flag symbol as the name, with a flag icon
        // Display name includes both symbol and name for clarity
        super(flagDef.type, '🚩');
        this.#flagDef = flagDef;
    }

    /** @returns {import('../macros/engine/MacroFlags.js').MacroFlagDefinition} */
    get flagDefinition() {
        return this.#flagDef;
    }

    /**
     * Renders the autocomplete list item for this flag.
     * Uses the same structure as other autocomplete options for consistent styling.
     * @returns {HTMLElement}
     */
    renderItem() {
        // Use base class makeItem for consistent styling
        const li = this.makeItem(
            `${this.#flagDef.type} ${this.#flagDef.name}`, // Display: "? Optional"
            '🚩',
            true, // noSlash
            [], // namedArguments
            [], // unnamedArguments
            'void', // returnType
            this.#flagDef.description + (this.#flagDef.implemented ? '' : ' (planned)'), // helpString
        );
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'flag');
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
 * Enum of variable shorthand prefix types.
 * @readonly
 * @enum {string}
 */
export const VariableShorthandType = Object.freeze({
    /** Local variable prefix (`.`) */
    LOCAL: '.',
    /** Global variable prefix (`$`) */
    GLOBAL: '$',
});

/**
 * @typedef {Object} VariableShorthandDefinition
 * @property {VariableShorthandType} type - The prefix symbol.
 * @property {string} name - Human-readable name.
 * @property {string} description - Description of what this prefix does.
 * @property {string[]} operations - List of supported operations.
 */

/**
 * Definitions for variable shorthand prefixes.
 * @type {Map<string, VariableShorthandDefinition>}
 */
export const VariableShorthandDefinitions = new Map([
    [VariableShorthandType.LOCAL, {
        type: VariableShorthandType.LOCAL,
        name: 'Local Variable',
        description: 'Access or modify a local variable (scoped to current chat).',
        operations: ['get', 'set (=)', 'increment (++)', 'decrement (--)', 'add (+=)', 'subtract (-=)', 'logical or (||)', 'nullish coalescing (??)', 'logical or assign (||=)', 'nullish coalescing assign (??=)', 'equals (==)', 'not equals (!=)', 'greater than (>)', 'greater than or equal (>=)', 'less than (<)', 'less than or equal (<=)'],
    }],
    [VariableShorthandType.GLOBAL, {
        type: VariableShorthandType.GLOBAL,
        name: 'Global Variable',
        description: 'Access or modify a global variable (shared across all chats).',
        operations: ['get', 'set (=)', 'increment (++)', 'decrement (--)', 'add (+=)', 'subtract (-=)', 'logical or (||)', 'nullish coalescing (??)', 'logical or assign (||=)', 'nullish coalescing assign (??=)', 'equals (==)', 'not equals (!=)', 'greater than (>)', 'greater than or equal (>=)', 'less than (<)', 'less than or equal (<=)'],
    }],
]);

/**
 * Set of valid variable shorthand prefix symbols.
 * @type {Set<string>}
 */
export const ValidVariableShorthandSymbols = new Set(Object.values(VariableShorthandType));

/**
 * Regex pattern for valid variable shorthand names.
 * Must start with a letter, can contain word chars, underscores and hyphens, but must not end with an underscore or hyphen.
 * Examples: myVar, my-var, my_var, myVar123, my-long-var-name
 * Invalid: my-, my--, -var, 123var
 * @type {RegExp}
 */
const VARIABLE_SHORTHAND_NAME_PATTERN = new RegExp(`^${MACRO_VARIABLE_SHORTHAND_PATTERN.source}`);

/**
 * Checks if a variable name is valid for use with variable shorthand syntax.
 * @param {string} name - The variable name to validate.
 * @returns {boolean} True if the name is valid for shorthand syntax.
 */
export function isValidVariableShorthandName(name) {
    if (!name || typeof name !== 'string') return false;
    return VARIABLE_SHORTHAND_NAME_PATTERN.test(name);
}

/**
 * Autocomplete option for variable shorthand prefixes.
 * Shows prefix symbol, name, and description.
 * This provides entry into the variable shorthand syntax ({{.varName}} or {{$varName}}).
 */
export class VariableShorthandAutoCompleteOption extends AutoCompleteOption {
    /** @type {VariableShorthandDefinition} */
    #varDef;

    /**
     * @param {VariableShorthandDefinition} varDef - The variable shorthand definition.
     */
    constructor(varDef) {
        // Use the prefix symbol as the name, with a variable icon
        super(varDef.type, '📦');
        this.#varDef = varDef;
    }

    /** @returns {VariableShorthandDefinition} */
    get variableDefinition() {
        return this.#varDef;
    }

    /**
     * Renders the autocomplete list item for this variable shorthand.
     * @returns {HTMLElement}
     */
    renderItem() {
        const li = this.makeItem(
            `${this.#varDef.type} ${this.#varDef.name}`,
            '📦',
            true, // noSlash
            [], // namedArguments
            [], // unnamedArguments
            'any', // returnType
            this.#varDef.description,
        );
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'variable-shorthand');
        return li;
    }

    /**
     * Renders the details panel for this variable shorthand.
     * @returns {DocumentFragment}
     */
    renderDetails() {
        const frag = document.createDocumentFragment();

        const details = document.createElement('div');
        details.classList.add('macro-variable-details');

        // Header with prefix symbol and name
        const header = document.createElement('h3');
        header.classList.add('macro-variable-details-header');
        header.innerHTML = `<code>${this.#varDef.type}</code> ${this.#varDef.name}`;
        details.append(header);

        // Description
        const desc = document.createElement('p');
        desc.classList.add('macro-variable-details-desc');
        desc.textContent = this.#varDef.description;
        details.append(desc);

        // Supported operations
        const opsHeader = document.createElement('p');
        opsHeader.innerHTML = '<strong>Supported Operations:</strong>';
        details.append(opsHeader);

        const opsList = document.createElement('ul');
        opsList.classList.add('macro-variable-details-ops');
        for (const op of this.#varDef.operations) {
            const li = document.createElement('li');
            li.textContent = op;
            opsList.append(li);
        }
        details.append(opsList);

        // Examples
        const exampleHeader = document.createElement('p');
        exampleHeader.innerHTML = '<strong>Examples:</strong>';
        details.append(exampleHeader);

        const exampleList = document.createElement('ul');
        exampleList.classList.add('macro-variable-details-examples');
        const prefix = this.#varDef.type;
        const examples = [
            `{{${prefix}myvar}} - Get variable value`,
            `{{${prefix}myvar = value}} - Set variable (returns nothing)`,
            `{{${prefix}counter++}} - Increment and get value`,
            `{{${prefix}counter--}} - Decrement and get value`,
            `{{${prefix}myvar += text}} - Append/add (returns nothing)`,
            `{{${prefix}score -= 5}} - Subtract (returns nothing)`,
            `{{${prefix}myvar || default}} - Get with fallback if falsy`,
            `{{${prefix}myvar ?? default}} - Get with fallback if undefined`,
            `{{${prefix}myvar ||= value}} - Set if falsy, get value`,
            `{{${prefix}myvar ??= value}} - Set if undefined, get value`,
            `{{${prefix}myvar == test}} - Compare (returns true/false)`,
            `{{${prefix}myvar != test}} - Compare not equal (returns true/false)`,
            `{{${prefix}score > 10}} - Greater than (numeric, returns true/false)`,
            `{{${prefix}score >= 10}} - Greater than or equal (numeric)`,
            `{{${prefix}score < 10}} - Less than (numeric, returns true/false)`,
            `{{${prefix}score <= 10}} - Less than or equal (numeric)`,
        ];
        for (const ex of examples) {
            const li = document.createElement('li');
            li.innerHTML = `<code>${ex.split(' - ')[0]}</code> - ${ex.split(' - ')[1]}`;
            exampleList.append(li);
        }
        details.append(exampleList);

        frag.append(details);
        return frag;
    }
}

/**
 * Autocomplete option for a specific variable name.
 * Shows variable name with scope indicator (local/global).
 */
export class VariableNameAutoCompleteOption extends AutoCompleteOption {
    /** @type {string} */
    #varName;

    /** @type {'local'|'global'} */
    #scope;

    /** @type {boolean} */
    #isNewVariable;

    /** @type {boolean} */
    #isInvalidName;

    /**
     * @param {string} varName - The variable name.
     * @param {'local'|'global'} scope - Whether this is a local or global variable.
     * @param {boolean} [isNewVariable=false] - Whether this is a "create new variable" option.
     * @param {boolean} [isInvalidName=false] - Whether this name is invalid for shorthand syntax.
     */
    constructor(varName, scope, isNewVariable = false, isInvalidName = false) {
        const icon = scope === 'local' ? 'L' : 'G';
        super(varName, icon);
        this.#varName = varName;
        this.#scope = scope;
        this.#isNewVariable = isNewVariable;
        this.#isInvalidName = isInvalidName;
    }

    /** @returns {string} */
    get variableName() {
        return this.#varName;
    }

    /** @returns {'local'|'global'} */
    get scope() {
        return this.#scope;
    }

    /** @returns {boolean} */
    get isNewVariable() {
        return this.#isNewVariable;
    }

    /** @returns {boolean} */
    get isInvalidName() {
        return this.#isInvalidName;
    }

    /**
     * Renders the autocomplete list item for this variable.
     * @returns {HTMLElement}
     */
    renderItem() {
        const scopeLabel = this.#scope === 'local' ? 'Local' : 'Global';
        let description;
        if (this.#isInvalidName) {
            description = '⚠️ Invalid variable name for shorthand';
        } else if (this.#isNewVariable) {
            description = `Define new ${scopeLabel.toLowerCase()} variable`;
        } else {
            description = `${scopeLabel} variable`;
        }

        const li = this.makeItem(
            this.#varName,
            this.typeIcon,
            true, // noSlash
            [], // namedArguments
            [], // unnamedArguments
            'any', // returnType
            description,
        );
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'variable-name');
        if (this.#isNewVariable) {
            li.classList.add('variable-new');
        }
        if (this.#isInvalidName) {
            li.classList.add('variable-invalid');
        }
        return li;
    }

    /**
     * Renders the details panel for this variable.
     * @returns {DocumentFragment}
     */
    renderDetails() {
        const frag = document.createDocumentFragment();

        const details = document.createElement('div');
        details.classList.add('macro-variable-name-details');

        const scopeLabel = this.#scope === 'local' ? 'Local' : 'Global';
        const prefix = this.#scope === 'local' ? '.' : '$';

        // Show big warning for invalid names
        if (this.#isInvalidName) {
            const warningBox = document.createElement('div');
            warningBox.classList.add('variable-invalid-warning');
            warningBox.style.cssText = 'background: #ff000033; border: 2px solid #ff0000; border-radius: 4px; padding: 10px; margin-bottom: 10px;';

            const warningHeader = document.createElement('h3');
            warningHeader.style.cssText = 'color: #ff6b6b; margin: 0 0 8px 0;';
            warningHeader.textContent = '⚠️ Invalid Variable Name';
            warningBox.append(warningHeader);

            const warningText = document.createElement('p');
            warningText.style.cssText = 'margin: 0 0 8px 0;';
            warningText.innerHTML = `The name <code>${this.#varName}</code> cannot be used with variable shorthand syntax.`;
            warningBox.append(warningText);

            const rulesText = document.createElement('p');
            rulesText.style.cssText = 'margin: 0; font-size: 0.9em;';
            rulesText.innerHTML = '<strong>Valid names must:</strong><br>• Start with a letter (a-z, A-Z)<br>• Contain only letters, numbers, underscores, or hyphens<br>• Not end with an underscore or hyphen';
            warningBox.append(rulesText);

            details.append(warningBox);
            frag.append(details);
            return frag;
        }

        // Header
        const header = document.createElement('h3');
        header.innerHTML = this.#isNewVariable
            ? `<code>${prefix}${this.#varName}</code> (New ${scopeLabel} Variable)`
            : `<code>${prefix}${this.#varName}</code> ${scopeLabel} Variable`;
        details.append(header);

        // Description
        const desc = document.createElement('p');
        const variableSuggestion = this.#scope === 'local'
            ? 'Local variables are scoped to the current chat.'
            : 'Global variables are shared across all chats.';
        if (this.#isNewVariable) {
            desc.textContent = `Creates a new ${scopeLabel.toLowerCase()} variable named "${this.#varName}". ${variableSuggestion}`;
        } else {
            desc.textContent = `Access or modify the ${scopeLabel.toLowerCase()} variable "${this.#varName}". ${variableSuggestion}`;
        }
        details.append(desc);

        // Usage examples
        const usageHeader = document.createElement('p');
        usageHeader.innerHTML = '<strong>Usage:</strong>';
        details.append(usageHeader);

        const usageList = document.createElement('ul');
        const examples = [
            `{{${prefix}${this.#varName}}} - Get value`,
            `{{${prefix}${this.#varName} = value}} - Set value`,
            `{{${prefix}${this.#varName}++}} - Increment`,
            `{{${prefix}${this.#varName}--}} - Decrement`,
            `{{${prefix}${this.#varName} += text}} - Append/add`,
            `{{${prefix}${this.#varName} -= 5}} - Subtract`,
            `{{${prefix}${this.#varName} || default}} - Get with fallback if falsy`,
            `{{${prefix}${this.#varName} ?? default}} - Get with fallback if undefined`,
            `{{${prefix}${this.#varName} ||= value}} - Set if falsy, get value`,
            `{{${prefix}${this.#varName} ??= value}} - Set if undefined, get value`,
            `{{${prefix}${this.#varName} == test}} - Compare (returns true/false)`,
            `{{${prefix}${this.#varName} != test}} - Compare not equal (returns true/false)`,
            `{{${prefix}${this.#varName} > 10}} - Greater than (numeric)`,
            `{{${prefix}${this.#varName} >= 10}} - Greater than or equal (numeric)`,
            `{{${prefix}${this.#varName} < 10}} - Less than (numeric)`,
            `{{${prefix}${this.#varName} <= 10}} - Less than or equal (numeric)`,
        ];
        for (const ex of examples) {
            const li = document.createElement('li');
            li.innerHTML = `<code>${ex.split(' - ')[0]}</code> - ${ex.split(' - ')[1]}`;
            usageList.append(li);
        }
        details.append(usageList);

        frag.append(details);
        return frag;
    }
}

/**
 * Checks if an operator is a short one that could be a prefix of a longer operator.
 * For example, '>' is a prefix of '>=', '<' is a prefix of '<='.
 * @param {string} op - The operator to check.
 * @returns {boolean} True if the operator could be a prefix of a longer operator.
 */
function isShortOperatorPrefix(op) {
    // These operators could have longer variants typed after them
    const shortPrefixes = ['>', '<', '=', '|', '?', '+', '-', '!'];
    return shortPrefixes.includes(op);
}

/**
 * Variable shorthand operators with metadata.
 * @type {Map<string, { symbol: string, name: string, description: string, needsValue: boolean }>}
 */
export const VariableOperatorDefinitions = new Map([
    ['=', {
        symbol: '=',
        name: 'Set',
        description: 'Set the variable to a new value. Returns nothing.',
        needsValue: true,
    }],
    ['++', {
        symbol: '++',
        name: 'Increment',
        description: 'Increment the variable by 1 (numeric). Returns the new value.',
        needsValue: false,
    }],
    ['--', {
        symbol: '--',
        name: 'Decrement',
        description: 'Decrement the variable by 1 (numeric). Returns the new value.',
        needsValue: false,
    }],
    ['+=', {
        symbol: '+=',
        name: 'Add',
        description: 'Add to the variable (numeric addition or string concatenation). Returns nothing.',
        needsValue: true,
    }],
    ['-=', {
        symbol: '-=',
        name: 'Subtract',
        description: 'Subtract a numeric value from the variable. Returns nothing.',
        needsValue: true,
    }],
    ['||', {
        symbol: '||',
        name: 'Logical Or',
        description: 'Return the fallback value if the variable is falsy, otherwise return the variable value.',
        needsValue: true,
    }],
    ['??', {
        symbol: '??',
        name: 'Nullish Coalescing',
        description: 'Return the fallback value only if the variable does not exist, otherwise return the variable value (even if falsy).',
        needsValue: true,
    }],
    ['||=', {
        symbol: '||=',
        name: 'Logical Or Assign',
        description: 'If the variable is falsy, set it to the value and return it; otherwise return the current value.',
        needsValue: true,
    }],
    ['??=', {
        symbol: '??=',
        name: 'Nullish Coalescing Assign',
        description: 'If the variable does not exist, set it to the value and return it; otherwise return the current value.',
        needsValue: true,
    }],
    ['==', {
        symbol: '==',
        name: 'Equals',
        description: 'Compare the variable value to another value. Returns "true" or "false".',
        needsValue: true,
    }],
    ['!=', {
        symbol: '!=',
        name: 'Not Equals',
        description: 'Compare the variable value to another value. Returns "true" if not equal, "false" if equal.',
        needsValue: true,
    }],
    ['>', {
        symbol: '>',
        name: 'Greater Than',
        description: 'Numeric comparison. Returns "true" if variable is greater than value, "false" otherwise.',
        needsValue: true,
    }],
    ['>=', {
        symbol: '>=',
        name: 'Greater Than or Equal',
        description: 'Numeric comparison. Returns "true" if variable is greater than or equal to value, "false" otherwise.',
        needsValue: true,
    }],
    ['<', {
        symbol: '<',
        name: 'Less Than',
        description: 'Numeric comparison. Returns "true" if variable is less than value, "false" otherwise.',
        needsValue: true,
    }],
    ['<=', {
        symbol: '<=',
        name: 'Less Than or Equal',
        description: 'Numeric comparison. Returns "true" if variable is less than or equal to value, "false" otherwise.',
        needsValue: true,
    }],
]);

/**
 * Autocomplete option for a variable operator.
 * Shows operator symbol, name, and description.
 */
export class VariableOperatorAutoCompleteOption extends AutoCompleteOption {
    /** @type {{ symbol: string, name: string, description: string, needsValue: boolean }} */
    #operatorDef;

    /**
     * @param {{ symbol: string, name: string, description: string, needsValue: boolean }} operatorDef - The operator definition.
     */
    constructor(operatorDef) {
        super(operatorDef.symbol, '⚡');
        this.#operatorDef = operatorDef;
    }

    /** @returns {{ symbol: string, name: string, description: string, needsValue: boolean }} */
    get operatorDefinition() {
        return this.#operatorDef;
    }

    /**
     * Renders the autocomplete list item for this operator.
     * @returns {HTMLElement}
     */
    renderItem() {
        const li = this.makeItem(
            `${this.#operatorDef.symbol} ${this.#operatorDef.name}`,
            '⚡',
            true, // noSlash
            [], // namedArguments
            [], // unnamedArguments
            'void', // returnType
            this.#operatorDef.description,
        );
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'variable-operator');
        return li;
    }

    /**
     * Renders the details panel for this operator.
     * @returns {DocumentFragment}
     */
    renderDetails() {
        const frag = document.createDocumentFragment();

        const details = document.createElement('div');
        details.classList.add('macro-variable-operator-details');

        // Header
        const header = document.createElement('h3');
        header.innerHTML = `<code>${this.#operatorDef.symbol}</code> ${this.#operatorDef.name}`;
        details.append(header);

        // Description
        const desc = document.createElement('p');
        desc.textContent = this.#operatorDef.description;
        details.append(desc);

        // Value note
        const valueNote = document.createElement('p');
        valueNote.innerHTML = this.#operatorDef.needsValue
            ? '<em>This operator requires a value after it.</em>'
            : '<em>This operator does not take a value.</em>';
        details.append(valueNote);

        frag.append(details);
        return frag;
    }
}

/**
 * Non-selectable autocomplete option that shows context about the value being typed.
 * Displays info about what value is expected based on the operator.
 */
export class VariableValueContextAutoCompleteOption extends AutoCompleteOption {
    /** @type {{ symbol: string, name: string, description: string, needsValue: boolean }} */
    #operatorDef;

    /** @type {string} */
    #currentValue;

    /**
     * @param {{ symbol: string, name: string, description: string, needsValue: boolean }} operatorDef - The operator definition.
     * @param {string} [currentValue=''] - The value currently being typed.
     */
    constructor(operatorDef, currentValue = '') {
        super('value', '📝');
        this.#operatorDef = operatorDef;
        this.#currentValue = currentValue;
        this.forceFullNameMatch = true;
    }

    /** @returns {{ symbol: string, name: string, description: string, needsValue: boolean }} */
    get operatorDefinition() {
        return this.#operatorDef;
    }

    /**
     * Renders the autocomplete list item for this value context.
     * @returns {HTMLElement}
     */
    renderItem() {
        const li = this.makeItem(
            '<value>',
            '📝',
            true, // noSlash
            [], // namedArguments
            [], // unnamedArguments
            'any', // returnType
            `${this.#operatorDef.name} (${this.#operatorDef.symbol}) expects a value`,
        );
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'variable-value-context');
        return li;
    }

    /**
     * Renders the details panel for this value context.
     * @returns {DocumentFragment}
     */
    renderDetails() {
        const frag = document.createDocumentFragment();

        const details = document.createElement('div');
        details.classList.add('macro-variable-value-context-details');

        // Header
        const header = document.createElement('h3');
        header.innerHTML = `Value for <code>${this.#operatorDef.symbol}</code> (${this.#operatorDef.name})`;
        details.append(header);

        // Description of what value is expected
        const desc = document.createElement('p');
        desc.textContent = this.#operatorDef.description;
        details.append(desc);

        // Current value being typed
        if (this.#currentValue) {
            const currentNote = document.createElement('p');
            currentNote.innerHTML = `<em>Currently typing:</em> <code>${this.#currentValue}</code>`;
            details.append(currentNote);
        }

        // Hint
        const hint = document.createElement('p');
        hint.classList.add('hint');
        hint.innerHTML = '<em>Type your value and close with <code>}}</code> to complete the macro.</em>';
        details.append(hint);

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

    /** @type {string} */
    #paddingBefore;

    /** @type {string} */
    #paddingAfter;

    /** @type {boolean} */
    #isOptional;

    /** @type {number} */
    #nestingLevel;

    /**
     * @param {string} macroName - The name of the macro to close.
     * @param {Object} [options] - Optional configuration.
     * @param {string} [options.paddingBefore=''] - Whitespace after {{ in opening tag (target padding).
     * @param {string} [options.paddingAfter=''] - Whitespace before }} in opening tag (target padding).
     * @param {string} [options.currentPadding=''] - Whitespace the user has already typed after {{.
     * @param {boolean} [options.isOptional=false] - Whether this closing tag is for an optional scope.
     * @param {number} [options.nestingLevel=0] - Nesting level (0 = innermost).
     */
    constructor(macroName, options = {}) {
        // The closing tag is what we're suggesting - use /macroName as the name for matching
        const closingTag = `/${macroName}`;
        super(closingTag, '{/');
        this.#macroName = macroName;
        this.#paddingBefore = options.paddingBefore ?? '';
        this.#paddingAfter = options.paddingAfter ?? '';
        this.#isOptional = options.isOptional ?? false;
        this.#nestingLevel = options.nestingLevel ?? 0;

        // Calculate the replacement offset to replace any existing whitespace the user typed
        // This allows us to normalize the whitespace to match the opening tag's style
        const currentPadding = options.currentPadding ?? '';
        // Negative offset to start replacement earlier (eating the user's whitespace)
        this.replacementStartOffset = -currentPadding.length;

        // Custom valueProvider to return the correct replacement text
        // Includes the target paddingBefore from the opening tag, replacing any user-typed whitespace
        this.valueProvider = () => {
            // Return: paddingBefore + /macroName + paddingAfter + }}
            return `${this.#paddingBefore}/${macroName}${this.#paddingAfter}}}`;
        };

        // Make selectable so TAB completion works (valueProvider alone makes it non-selectable)
        this.makeSelectable = true;

        // nameOffset = 2 to skip the {{ prefix in the display for fuzzy highlighting
        // The name is /macroName but display shows {{/macroName}}
        this.nameOffset = 2;

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
        type.textContent = this.typeIcon;
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

        // Build description based on optional status and nesting
        if (this.#isOptional) {
            const optionalBadge = document.createElement('span');
            optionalBadge.classList.add('macro-ac-optional-badge', 'macro-ac-optional-badge-small');
            optionalBadge.textContent = 'OPTIONAL';
            content.append(optionalBadge);
            content.append(' ');

            const nestingInfo = this.#nestingLevel > 0 ? ` (nested ${this.#nestingLevel} level${this.#nestingLevel > 1 ? 's' : ''} deep)` : '';
            content.append(document.createTextNode(`Optionally close {{${this.#macroName}}}${nestingInfo}`));
        } else {
            content.textContent = `Close the {{${this.#macroName}}} scoped macro.`;
        }

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

        // If optional, show badge at the top
        if (this.#isOptional) {
            const optionalBadge = document.createElement('span');
            optionalBadge.classList.add('macro-ac-optional-badge');
            optionalBadge.textContent = 'OPTIONAL';
            details.append(optionalBadge);
        }

        // Header
        const header = document.createElement('h3');
        header.innerHTML = `Close <code>{{${this.#macroName}}}</code>`;
        details.append(header);

        // Description
        const desc = document.createElement('p');
        if (this.#isOptional) {
            const nestingInfo = this.#nestingLevel > 0 ? ` This scope is nested ${this.#nestingLevel} level${this.#nestingLevel > 1 ? 's' : ''} deep.` : '';
            desc.textContent = `Optionally inserts the closing tag {{/${this.#macroName}}}. The scoped content for this macro is optional - you can close it or leave it open.${nestingInfo}`;
        } else {
            desc.textContent = `Inserts the closing tag {{/${this.#macroName}}} to complete the scoped macro. The content between the opening and closing tags will be passed as the last argument.`;
        }
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

    // Skip leading whitespace (but NOT newlines - those stop macro parsing for autocomplete)
    while (i < macroText.length && /[ \t]/.test(macroText[i])) {
        i++;
    }

    // Extract flags (special symbols before the identifier)
    // Track position after each flag to determine which flag cursor is on
    // Special case: `/` followed by identifier chars is a closing tag, not a flag
    const flags = [];
    const flagEndPositions = []; // Position right after each flag (before any whitespace)
    while (i < macroText.length) {
        const char = macroText[i];
        // Check if this looks like a closing tag: `/` followed by an identifier character
        if (char === '/' && i + 1 < macroText.length && /[a-zA-Z/]/.test(macroText[i + 1])) {
            // This is a closing tag identifier, not a flag - stop parsing flags
            break;
        }
        if (ValidFlagSymbols.has(char)) {
            flags.push(char);
            i++;
            flagEndPositions.push(i); // Position right after this flag
            // Skip whitespace between flags (but NOT newlines - those stop macro parsing for autocomplete)
            while (i < macroText.length && /[ \t]/.test(macroText[i])) {
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

    if (flags.length > 0) {
        void onboardingExperimentalMacroEngine('macro flags');
    }

    // Check for variable shorthand prefix (. or $)
    // These trigger variable expression mode instead of regular macro parsing
    /** @type {'.'|'$'|null} */
    let variablePrefix = null;
    let variableName = '';
    /** @type {string|null} */
    let variableOperator = null;
    let variableValue = '';
    let isVariableShorthand = false;
    let isTypingVariableName = false;
    let isTypingOperator = false;
    let isTypingValue = false;
    let variableNameEnd = i;

    const remainingAfterFlags = macroText.slice(i);
    if (remainingAfterFlags.startsWith('.') || remainingAfterFlags.startsWith('$')) {
        isVariableShorthand = true;
        variablePrefix = /** @type {'.'|'$'} */ (remainingAfterFlags[0]);
        i++; // Move past the prefix

        // Variable names: start with letter, can have hyphens inside, must not end with hyphen
        const varNameMatch = macroText.slice(i).match(VARIABLE_SHORTHAND_NAME_PATTERN);
        if (varNameMatch) {
            variableName = varNameMatch[0];
            i += variableName.length;
        }
        variableNameEnd = i;

        // Skip whitespace before operator
        while (i < macroText.length && /\s/.test(macroText[i])) {
            i++;
        }

        // Check for operators: ++, --, +=, -=, ||=, ??=, ||, ??, ==, =
        // Order matters: longer operators must be checked before shorter ones
        // Also track partial operator prefixes for autocomplete
        const operatorText = macroText.slice(i);
        let hasInvalidTrailingChars = false;
        let invalidTrailingChars = '';
        let partialOperator = '';
        if (operatorText.startsWith('++')) {
            variableOperator = '++';
            i += 2;
        } else if (operatorText.startsWith('--')) {
            variableOperator = '--';
            i += 2;
        } else if (operatorText.startsWith('||=')) {
            variableOperator = '||=';
            i += 3;
        } else if (operatorText.startsWith('??=')) {
            variableOperator = '??=';
            i += 3;
        } else if (operatorText.startsWith('||')) {
            variableOperator = '||';
            i += 2;
        } else if (operatorText.startsWith('??')) {
            variableOperator = '??';
            i += 2;
        } else if (operatorText.startsWith('+=')) {
            variableOperator = '+=';
            i += 2;
        } else if (operatorText.startsWith('-=')) {
            variableOperator = '-=';
            i += 2;
        } else if (operatorText.startsWith('==')) {
            variableOperator = '==';
            i += 2;
        } else if (operatorText.startsWith('!=')) {
            variableOperator = '!=';
            i += 2;
        } else if (operatorText.startsWith('>=')) {
            variableOperator = '>=';
            i += 2;
        } else if (operatorText.startsWith('>')) {
            variableOperator = '>';
            i += 1;
        } else if (operatorText.startsWith('<=')) {
            variableOperator = '<=';
            i += 2;
        } else if (operatorText.startsWith('<')) {
            variableOperator = '<';
            i += 1;
        } else if (operatorText.startsWith('=')) {
            variableOperator = '=';
            i += 1;
        } else if (operatorText.startsWith('+') || operatorText.startsWith('-') || operatorText.startsWith('|') || operatorText.startsWith('?') || operatorText.startsWith('!') || operatorText.startsWith('>') || operatorText.startsWith('<')) {
            // Partial operator prefix - user is typing an operator
            partialOperator = operatorText[0];
        } else if (operatorText.length > 0 && !/^\s/.test(operatorText) && !operatorText.startsWith('}')) {
            // There's non-whitespace after the variable name that isn't a valid operator
            // This is an invalid trailing character (e.g., $my$ or .var@test)
            // Exception: } is the closing brace, not an invalid char
            hasInvalidTrailingChars = true;
            invalidTrailingChars = operatorText.trim();
        }

        // Track where the operator ends (for cursor position checks)
        const variableOperatorEnd = i;

        // Check if operator requires a value
        const operatorDef = variableOperator ? VariableOperatorDefinitions.get(variableOperator) : null;
        const operatorNeedsValue = operatorDef?.needsValue ?? false;

        // If operator requires a value, parse the value
        // Do this BEFORE isTypingClosingBrace detection so we can check for } in value area
        // let valueStartPos = i;
        if (operatorNeedsValue) {
            // Skip whitespace after operator
            while (i < macroText.length && /\s/.test(macroText[i])) {
                i++;
            }
            // valueStartPos = i;
            variableValue = macroText.slice(i).trimEnd();
        }

        // Detect if typing first closing brace on a variable shorthand
        // This happens when operatorText is just "}" or when cursor is beyond content (after }})
        let isTypingClosingBrace = false;
        if (operatorText.startsWith('}') && !variableOperator) {
            // Typing first } on a standalone variable shorthand like {{.Lila}
            isTypingClosingBrace = true;
        } else if (cursorOffset > macroText.length && !variableOperator) {
            // Cursor is after }} on a standalone variable shorthand like {{.Lila}}|
            isTypingClosingBrace = true;
        } else if (cursorOffset > macroText.length && variableOperator) {
            // Cursor is after }} on any operator shorthand like {{.Lila++}}| or {{.Lila+=4}}|
            isTypingClosingBrace = true;
        } else if (cursorOffset >= macroText.length && variableOperator && !operatorNeedsValue) {
            // Cursor at end of complete operator (++ or --) like {{.Lila++ or {{.Lila++  (with trailing space)
            isTypingClosingBrace = true;
        } else if (cursorOffset >= macroText.length && !variableOperator && variableName.length > 0) {
            // Cursor at end of standalone variable (with or without trailing whitespace) like {{.Lila or {{ .Lila
            isTypingClosingBrace = true;
        } else if (operatorNeedsValue && variableValue.length > 0 && variableValue.endsWith('}')) {
            // Typing first } after a value like {{.Lila+=4}
            isTypingClosingBrace = true;
            // Strip the } from the value
            variableValue = variableValue.slice(0, -1);
        } else if (operatorNeedsValue && cursorOffset >= macroText.length && variableValue.length > 0) {
            // Cursor at end after typing a value (including trailing whitespace) like {{.Lila+=4
            // This means the shorthand is "complete" and ready to close
            isTypingClosingBrace = true;
        }

        // Determine cursor position context for autocomplete
        // Note: isTypingClosingBrace takes precedence - if we're typing a closing brace,
        // we don't want to show operator suggestions, just the current state
        const prefixEnd = (macroText.indexOf(variablePrefix) ?? 0) + 1;
        if (cursorOffset < prefixEnd) {
            // Cursor is before the prefix - still in flags area conceptually
            isTypingVariableName = false;
        } else if (cursorOffset <= variableNameEnd) {
            // Cursor is in the variable name area (including at the end)
            isTypingVariableName = true;
        } else if (variableName.length > 0 && !variableOperator && !hasInvalidTrailingChars && !isTypingClosingBrace) {
            // Cursor is after variable name but no operator yet (and no invalid chars)
            // This includes partial operator prefixes like '+', '-', '|', '?', '>', '<'
            // But NOT when typing a closing brace - that takes precedence
            isTypingOperator = true;
        } else if (variableName.length > 0 && variableOperator && isShortOperatorPrefix(variableOperator) && cursorOffset <= variableOperatorEnd) {
            // Short operator that could be prefix of longer one (e.g., > could become >=)
            // But ONLY if cursor is still in the operator area, not past it into value
            isTypingOperator = true;
        } else if (operatorNeedsValue) {
            // Operator that requires value - cursor is in value area
            isTypingValue = true;
        }
        // For ++ and --, the operator is complete (no value needed)
        // For invalid trailing chars, none of the typing flags will be true
        const isOperatorComplete = (variableOperator === '++' || variableOperator === '--');

        void onboardingExperimentalMacroEngine('variable shorthands');

        // Return early for variable shorthand - different structure than regular macros
        return {
            fullText: macroText,
            cursorOffset,
            paddingBefore: macroText.match(/^\s+/)?.[0] ?? '',
            identifier: '', // No macro identifier for variable shorthand
            identifierStart: -1,
            isInFlagsArea: false,
            flags,
            currentFlag,
            args: [],
            currentArgIndex: -1,
            isTypingSeparator: false,
            isTypingClosingBrace,
            hasSpaceAfterIdentifier: false,
            hasSpaceArgContent: false,
            separatorCount: 0,
            // Variable shorthand specific properties
            isVariableShorthand,
            variablePrefix,
            variableName,
            variableNameEnd,
            variableOperator,
            variableOperatorEnd,
            variableValue,
            isTypingVariableName,
            isTypingOperator,
            isTypingValue,
            isOperatorComplete,
            hasInvalidTrailingChars,
            invalidTrailingChars,
            partialOperator,
        };
    }

    // Regular macro parsing (not variable shorthand)
    // Now parse the identifier and arguments starting from position i
    const remainingText = macroText.slice(i);
    const parts = [];
    /** @type {{ start: number, end: number }[]} */
    const separatorPositions = []; // Track positions of :: separators
    let currentPart = '';
    let partStart = i;
    let j = 0;

    // Track nesting depth to skip :: inside nested macros
    let nestedDepth = 0;
    // Track if we've seen a :: separator - newlines before first :: should stop parsing
    let hasSeenSeparator = false;
    // Track if we broke early (e.g., at a newline)
    let brokeEarly = false;
    while (j < remainingText.length) {
        // Before the first :: separator, newlines should stop parsing
        // This prevents text on the next line from being considered part of the identifier/space-arg
        if (!hasSeenSeparator && nestedDepth === 0 && (remainingText[j] === '\n' || remainingText[j] === '\r')) {
            // Stop parsing here - don't include the newline or anything after
            brokeEarly = true;
            break;
        }
        // Track nested macro braces
        if (remainingText[j] === '{' && remainingText[j + 1] === '{') {
            nestedDepth++;
            currentPart += '{{';
            j += 2;
            continue;
        }
        if (remainingText[j] === '}' && remainingText[j + 1] === '}') {
            nestedDepth = Math.max(0, nestedDepth - 1);
            currentPart += '}}';
            j += 2;
            continue;
        }
        // Only count :: as separator when not inside nested macros
        if (nestedDepth === 0 && remainingText[j] === ':' && remainingText[j + 1] === ':') {
            parts.push({ text: currentPart, start: partStart, end: i + j });
            separatorPositions.push({ start: i + j, end: i + j + 2 });
            currentPart = '';
            j += 2;
            partStart = i + j;
            hasSeenSeparator = true;
        } else {
            currentPart += remainingText[j];
            j++;
        }
    }
    // Push the last part - use correct end position if we broke early.
    // If we broke early (at a newline) AND cursor is past that point, don't push -
    // this filters out text on the next line from being considered part of this macro.
    // But if we didn't break early (cursor at end of closed macro), always push.
    const lastPartEnd = brokeEarly ? i + j : macroText.length;
    const shouldPushLastPart = !brokeEarly || cursorOffset <= lastPartEnd;
    if (shouldPushLastPart) {
        parts.push({ text: currentPart, start: partStart, end: lastPartEnd });
    }

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

    const leftPadding = macroText.match(/^\s+/)?.[0] ?? '';

    if (leftPadding) {
        void onboardingExperimentalMacroEngine('leading whitespace');
    }

    // Clean identifier: strip trailing colons (for partial :: typing)
    // Also strip trailing single } (for partial }} typing) - but only if no separators/args
    let cleanIdentifier = identifierOnly.replace(/:+$/, '');
    let isTypingClosingBrace = false;
    if (separatorPositions.length === 0 && !hasSpaceAfterIdentifier && cleanIdentifier.endsWith('}')) {
        // Typing first closing brace on a standalone macro like {{char}
        cleanIdentifier = cleanIdentifier.slice(0, -1);
        isTypingClosingBrace = true;
    }

    // Build args array - include space-separated arg if present
    // Trim args like the macro engine does
    let args = parts.slice(1).map(p => p.text.trim());
    if (spaceArgText.length > 0) {
        args = [spaceArgText, ...args];
    }

    return {
        fullText: macroText,
        cursorOffset,
        paddingBefore: leftPadding,
        identifier: cleanIdentifier,
        identifierStart: identifierStartPos,
        isInFlagsArea,
        flags,
        currentFlag,
        args,
        currentArgIndex,
        isTypingSeparator,
        isTypingClosingBrace,
        hasSpaceAfterIdentifier,
        hasSpaceArgContent: spaceArgText.length > 0,
        separatorCount: separatorPositions.length,
        // Default variable shorthand properties (not a variable shorthand)
        isVariableShorthand: false,
        variablePrefix: null,
        variableName: '',
        variableNameEnd: null,
        variableOperator: null,
        variableOperatorEnd: null,
        variableValue: '',
        isTypingVariableName: false,
        isTypingOperator: false,
        isTypingValue: false,
    };
}

/**
 * A simple, generic autocomplete option for displaying basic items with name, symbol, and description.
 * Useful for simple options like inversion markers, prefixes, etc. without needing a full custom class.
 *
 * @extends AutoCompleteOption
 */
export class SimpleAutoCompleteOption extends AutoCompleteOption {
    /** @type {string} */
    #description;

    /** @type {string|null} */
    #detailedDescription;

    /**
     * @param {Object} config - Configuration for the option.
     * @param {string} config.name - The option name/key (used for matching).
     * @param {string} [config.symbol=' '] - Icon/symbol shown in the type column.
     * @param {string} [config.description=''] - Short description shown inline.
     * @param {string} [config.detailedDescription] - Longer description for details panel (supports HTML). Falls back to description if not provided.
     * @param {string} [config.type='simple'] - Type identifier for CSS/data attributes.
     */
    constructor({ name, symbol = ' ', description = '', detailedDescription = null, type = 'simple' }) {
        super(name, symbol, type);
        this.#description = description;
        this.#detailedDescription = detailedDescription;
    }

    /** @returns {string} */
    get description() {
        return this.#description;
    }

    /** @returns {string} */
    get detailedDescription() {
        return this.#detailedDescription ?? this.#description;
    }

    /**
     * @returns {HTMLElement}
     */
    renderItem() {
        const li = document.createElement('li');
        li.classList.add('item');
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', this.type);

        // Type icon
        const typeSpan = document.createElement('span');
        typeSpan.classList.add('type', 'monospace');
        typeSpan.textContent = this.typeIcon;
        li.append(typeSpan);

        // Name
        const specs = document.createElement('span');
        specs.classList.add('specs');
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('name', 'monospace');
        this.name.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            nameSpan.append(span);
        });
        specs.append(nameSpan);
        li.append(specs);

        // Stopgap
        const stopgap = document.createElement('span');
        stopgap.classList.add('stopgap');
        li.append(stopgap);

        // Help/description
        const help = document.createElement('span');
        help.classList.add('help');
        const content = document.createElement('span');
        content.classList.add('helpContent');
        content.textContent = this.#description;
        help.append(content);
        li.append(help);

        return li;
    }

    /**
     * @returns {DocumentFragment}
     */
    renderDetails() {
        const frag = document.createDocumentFragment();

        // Header with name
        const specs = document.createElement('div');
        specs.classList.add('specs');
        const nameDiv = document.createElement('div');
        nameDiv.classList.add('name', 'monospace');
        nameDiv.textContent = this.name;
        specs.append(nameDiv);
        frag.append(specs);

        // Description
        if (this.detailedDescription) {
            const helpDiv = document.createElement('div');
            helpDiv.classList.add('help');
            helpDiv.innerHTML = this.detailedDescription;
            frag.append(helpDiv);
        }

        return frag;
    }
}
